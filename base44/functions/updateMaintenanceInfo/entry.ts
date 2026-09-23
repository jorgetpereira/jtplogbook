import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const expense_id = body.event?.entity_id || body.expense_id;

    if (!expense_id) {
      return Response.json({ error: 'Missing expense_id' }, { status: 400 });
    }

    // Automation triggers (body.event present) are platform-authenticated;
    // direct calls require user auth and use user-scoped calls (RLS protects).
    const isAutomation = !!body.event;
    if (!isAutomation) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = isAutomation ? base44.asServiceRole : base44;

    const expense = await client.entities.Expense.get(expense_id);
    if (!expense) {
      return Response.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only update if it's a "Revisão" (maintenance)
    if (expense.category !== 'Manutenção' || expense.sub_category !== 'Revisão') {
      return Response.json({ message: 'Not a maintenance expense' }, { status: 200 });
    }

    // Update vehicle with latest maintenance info
    await client.entities.Vehicle.update(expense.vehicle_id, {
      last_maintenance_date: expense.date,
      last_maintenance_km: expense.mileage_at_expense
    });

    // Update or create MaintenanceSchedule for this vehicle (Revisão)
    const schedules = await client.entities.MaintenanceSchedule.filter({
      vehicle_id: expense.vehicle_id,
      name: "Revisão completa"
    });

    if (schedules.length > 0) {
      await client.entities.MaintenanceSchedule.update(schedules[0].id, {
        last_done_km: expense.mileage_at_expense,
        last_done_date: expense.date
      });
    } else {
      await client.entities.MaintenanceSchedule.create({
        vehicle_id: expense.vehicle_id,
        name: "Revisão completa",
        interval_km: 15000,
        interval_months: 12,
        warning_km: 500,
        last_done_km: expense.mileage_at_expense,
        last_done_date: expense.date,
        is_active: true
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});