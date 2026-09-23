import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getSheetConfigs, syncEntityToSheet } from '../../shared/gsBackup.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { spreadsheet_id, sheets } = body;

    if (!spreadsheet_id) return Response.json({ error: 'ID da spreadsheet em falta' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const configs = getSheetConfigs(sheets);

    const fetchers: Record<string, () => Promise<any[]>> = {
      Vehicle: () => base44.entities.Vehicle.list("-created_date", 500),
      Expense: () => base44.entities.Expense.list("-date", 1000),
      Charging: () => base44.entities.Charging.list("-start_datetime", 1000),
      Notification: () => base44.entities.Notification.list("-due_date", 500),
      MaintenanceSchedule: () => base44.entities.MaintenanceSchedule.list("-created_date", 500),
      VehiclePart: () => base44.entities.VehiclePart.list("-created_date", 500),
      VehicleDocument: () => base44.entities.VehicleDocument.list("-created_date", 500),
      Insurance: () => base44.entities.Insurance.list("-created_date", 500),
      InspectionChecklist: () => base44.entities.InspectionChecklist.list("-created_date", 500),
      Location: () => base44.entities.Location.list("name", 500),
    };

    const results = [];

    for (const config of configs) {
      try {
        let records;

        if (config.entity === "LoanSummary") {
          // Build a combined loan view: vehicle loan info + payment records
          const allVehicles = await base44.entities.Vehicle.list("-created_date", 500);
          const loanExpenses = await base44.entities.Expense.filter({ category: "Empréstimos" }, "-date", 1000);
          const vehiclesWithLoans = allVehicles.filter((v: any) => v.loan_amount && v.loan_amount > 0);

          const loanRecords: any[] = [];

          // Add payment records enriched with loan context
          for (const expense of loanExpenses) {
            const vehicle = allVehicles.find((v: any) => v.id === expense.vehicle_id);
            const totalPaid = loanExpenses
              .filter((e: any) => e.vehicle_id === expense.vehicle_id)
              .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
            const loanAmount = vehicle?.loan_amount || 0;
            const remaining = loanAmount - totalPaid;

            loanRecords.push({
              date: expense.date,
              vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}` : "",
              license_plate: vehicle?.license_plate || "",
              sub_category: expense.sub_category || "",
              payment_amount: expense.amount,
              description: expense.description || "",
              initial_loan: loanAmount,
              total_paid: totalPaid,
              remaining: remaining,
            });
          }

          // Add vehicles with loans but no payments yet
          for (const v of vehiclesWithLoans) {
            if (!loanExpenses.some((e: any) => e.vehicle_id === v.id)) {
              loanRecords.push({
                date: "",
                vehicle: `${v.brand} ${v.model}`,
                license_plate: v.license_plate,
                sub_category: "",
                payment_amount: 0,
                description: "Sem pagamentos registados",
                initial_loan: v.loan_amount,
                total_paid: 0,
                remaining: v.loan_amount,
              });
            }
          }

          records = loanRecords;
        } else if (config.entity === "VehicleIssue" && config.filter) {
          records = await base44.entities.VehicleIssue.filter(config.filter, "-created_date", 500);
        } else {
          records = await fetchers[config.entity]();
        }

        const result = await syncEntityToSheet(accessToken, spreadsheet_id, config.sheetName, records);
        results.push({ ...result, entity: config.entity });
      } catch (e) {
        results.push({ sheet: config.sheetName, entity: config.entity, error: e.message });
      }
    }

    // Store backup status on the current user
    let totalNew = 0, errors = 0;
    results.forEach((r) => { if (r.error) errors++; totalNew += r.new || 0; });
    try {
      await base44.auth.updateMe({
        sheets_backup_last_date: new Date().toISOString(),
        sheets_backup_last_status: errors > 0 ? (totalNew > 0 ? "partial" : "error") : "success",
      });
    } catch (e) { /* ignore */ }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}