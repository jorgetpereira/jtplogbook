import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getSheetConfigs, syncEntityToSheet } from '../../shared/gsBackup.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Get Google Sheets connection (service role)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    // Get all users who have a sheets_backup_url configured
    const users = await base44.asServiceRole.entities.User.list();
    const usersWithBackup = users.filter((u: any) => u.sheets_backup_url);

    if (usersWithBackup.length === 0) {
      return Response.json({ success: true, message: "No users with backup configured." });
    }

    const allResults = [];

    for (const user of usersWithBackup) {
      try {
        const url = user.sheets_backup_url;
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
          allResults.push({ user: user.email, error: "Invalid spreadsheet URL" });
          continue;
        }
        const spreadsheetId = match[1];
        const sheetNames = user.sheets_backup_names || {};
        const configs = getSheetConfigs(sheetNames);

        // Fetch this user's records (filtered by created_by_id)
        const userResults = [];
        for (const config of configs) {
          try {
            let records;
            const filter = { created_by_id: user.id, ...(config.filter || {}) };

            if (config.entity === "Vehicle") {
              records = await base44.asServiceRole.entities.Vehicle.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "Expense") {
              records = await base44.asServiceRole.entities.Expense.filter({ created_by_id: user.id }, "-date", 1000);
            } else if (config.entity === "Charging") {
              records = await base44.asServiceRole.entities.Charging.filter({ created_by_id: user.id }, "-start_datetime", 1000);
            } else if (config.entity === "Notification") {
              records = await base44.asServiceRole.entities.Notification.filter({ created_by_id: user.id }, "-due_date", 500);
            } else if (config.entity === "VehicleIssue") {
              records = await base44.asServiceRole.entities.VehicleIssue.filter(filter, "-created_date", 500);
            } else if (config.entity === "MaintenanceSchedule") {
              records = await base44.asServiceRole.entities.MaintenanceSchedule.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "VehiclePart") {
              records = await base44.asServiceRole.entities.VehiclePart.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "VehicleDocument") {
              records = await base44.asServiceRole.entities.VehicleDocument.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "Insurance") {
              records = await base44.asServiceRole.entities.Insurance.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "InspectionChecklist") {
              records = await base44.asServiceRole.entities.InspectionChecklist.filter({ created_by_id: user.id }, "-created_date", 500);
            } else if (config.entity === "Location") {
              // Location is a shared entity — fetch all (own + admin-created visible to this user)
              records = await base44.asServiceRole.entities.Location.list("name", 500);
            } else {
              continue;
            }

            const result = await syncEntityToSheet(accessToken, spreadsheetId, config.sheetName, records);
            userResults.push(result);
          } catch (e) {
            userResults.push({ sheet: config.sheetName, error: e.message });
          }
        }

        // Send email notification to the user
        let totalNew = 0;
        let errors = 0;
        userResults.forEach((r) => {
          if (r.error) errors++;
          totalNew += r.new || 0;
        });

        // Store backup status on the user entity
        try {
          await base44.asServiceRole.entities.User.update(user.id, {
            sheets_backup_last_date: new Date().toISOString(),
            sheets_backup_last_status: errors > 0 ? (totalNew > 0 ? "partial" : "error") : "success",
          });
        } catch (updateErr) {
          console.warn("Failed to update user backup status", user.email, updateErr);
        }

        allResults.push({ user: user.email, totalNew, errors, results: userResults });
      } catch (e) {
        allResults.push({ user: user.email, error: e.message });
      }
    }

    return Response.json({ success: true, date: now.toISOString(), results: allResults });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}