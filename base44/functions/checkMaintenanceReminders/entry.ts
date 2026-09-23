import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { addMonths, addYears, differenceInCalendarYears, format, parseISO } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [vehicles, expenses, schedules, notifications] = await Promise.all([
      base44.entities.Vehicle.list(),
      base44.entities.Expense.list('-date', 500),
      base44.entities.MaintenanceSchedule.filter({ is_active: true }),
      base44.entities.Notification.filter({ is_completed: false }),
    ]);

    const created = [];

    // --- 1. Km-based schedules ---
    for (const schedule of schedules) {
      if (!schedule.vehicle_id) continue;

      const vehicle = vehicles.find(v => v.id === schedule.vehicle_id);
      if (!vehicle) continue;

      // Current km: max mileage from expenses or vehicle record
      const vExp = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense);
      const currentKm = vExp.length > 0
        ? Math.max(...vExp.map(e => e.mileage_at_expense))
        : vehicle.mileage || 0;

      const warningKm = schedule.warning_km || 500;
      let shouldNotifyKm = false;
      let nextKm = null;

      if (schedule.interval_km && schedule.last_done_km) {
        nextKm = schedule.last_done_km + schedule.interval_km;
        shouldNotifyKm = currentKm >= (nextKm - warningKm);
      }

      // Date-based check
      let shouldNotifyDate = false;
      let nextDate = null;
      if (schedule.interval_months && schedule.last_done_date) {
        const lastDate = parseISO(schedule.last_done_date);
        const next = addMonths(lastDate, schedule.interval_months);
        nextDate = format(next, 'yyyy-MM-dd');
        const today = new Date();
        const daysLeft = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        shouldNotifyDate = daysLeft <= 30; // warn 30 days before
      }

      if (!shouldNotifyKm && !shouldNotifyDate) continue;

      // Check if notification already exists for this schedule
      const alreadyExists = notifications.some(n =>
        n.vehicle_id === vehicle.id &&
        n.type === 'Revisão' &&
        n.message && n.message.includes(schedule.name)
      );
      if (alreadyExists) continue;

      const parts = [];
      if (nextKm) parts.push(`Próxima aos ${nextKm.toLocaleString()} km (atual: ${Math.round(currentKm).toLocaleString()} km)`);
      if (nextDate) parts.push(`Data limite: ${nextDate}`);

      await base44.entities.Notification.create({
        vehicle_id: vehicle.id,
        title: `${schedule.name} — ${vehicle.brand} ${vehicle.model}`,
        message: parts.join(' · '),
        type: 'Revisão',
        due_date: nextDate || new Date().toISOString().split('T')[0],
        is_read: false,
        is_completed: false,
      });

      created.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, schedule: schedule.name });
    }

    // --- 2. Legacy: vehicles without schedules, check fixed 15000km interval ---
    const vehiclesWithSchedules = new Set(schedules.map(s => s.vehicle_id));
    for (const vehicle of vehicles) {
      if (!vehicle.is_active || vehiclesWithSchedules.has(vehicle.id)) continue;

      const vExp = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestKm = vExp.length > 0 ? vExp[0].mileage_at_expense : vehicle.mileage || 0;
      if (!latestKm || latestKm < 500) continue;

      const INTERVAL = 15000;
      const WARNING = 500;
      const nextMilestone = Math.ceil(latestKm / INTERVAL) * INTERVAL;
      if (latestKm < nextMilestone - WARNING) continue;

      const alreadyExists = notifications.some(n =>
        n.vehicle_id === vehicle.id &&
        n.type === 'Revisão' &&
        n.message && n.message.includes(nextMilestone.toString())
      );
      if (alreadyExists) continue;

      await base44.entities.Notification.create({
        vehicle_id: vehicle.id,
        title: `Manutenção periódica — ${vehicle.brand} ${vehicle.model}`,
        message: `Quilometragem atual: ${Math.round(latestKm)} km. Próxima revisão recomendada aos ${nextMilestone} km.`,
        type: 'Revisão',
        due_date: new Date().toISOString().split('T')[0],
        is_completed: false,
      });

      created.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, schedule: 'Revisão periódica (15 000 km)' });
    }

    // --- 3. Vehicle Inspection (IPO) — 4y, then 2y until age 8, then annual ---
    function getNextInspectionDate(vehicleYear, lastInspectionDateStr, registrationDateStr) {
      const registrationDate = registrationDateStr
        ? parseISO(registrationDateStr)
        : new Date(vehicleYear, 0, 1);
      const today = new Date();

      if (lastInspectionDateStr) {
        const lastDate = parseISO(lastInspectionDateStr);
        // IPO dates are always anchored to the registration anniversary (day/month).
        // Find the first milestone more than 90 days after the last inspection
        // (IPO can be done up to 3 months before the due date, per Portuguese law).
        const NINETY_DAYS_MS = 1000 * 60 * 60 * 24 * 90;
        let age = 4;
        while (age <= 100) {
          const milestone = addYears(registrationDate, age);
          if (milestone.getTime() - lastDate.getTime() > NINETY_DAYS_MS) return milestone;
          age = age < 8 ? age + 2 : age + 1;
        }
        return null;
      }

      const vehicleAge = differenceInCalendarYears(today, registrationDate);
      if (vehicleAge < 4) return addYears(registrationDate, 4);

      let age = 4;
      let nextDate = addYears(registrationDate, 4);
      while (nextDate <= today) {
        age = age < 8 ? age + 2 : age + 1;
        nextDate = addYears(registrationDate, age);
      }
      return nextDate;
    }

    for (const vehicle of vehicles) {
      if (!vehicle.is_active || !vehicle.year) continue;

      const inspExpenses = expenses
        .filter(e => e.vehicle_id === vehicle.id && e.sub_category === 'Inspeção')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastInspDate = inspExpenses.length > 0 ? inspExpenses[0].date : null;

      const nextInsp = getNextInspectionDate(vehicle.year, lastInspDate, vehicle.registration_date);
      if (!nextInsp) continue;

      const today = new Date();
      const daysLeft = Math.ceil((nextInsp - today) / (1000 * 60 * 60 * 24));

      if (daysLeft > 30) continue;

      const alreadyExists = notifications.some(n =>
        n.vehicle_id === vehicle.id &&
        n.type === 'Inspeção' &&
        !n.is_completed
      );
      if (alreadyExists) continue;

      await base44.entities.Notification.create({
        vehicle_id: vehicle.id,
        title: `Inspeção IPO — ${vehicle.brand} ${vehicle.model}`,
        message: daysLeft < 0
          ? `A inspeção do seu veículo está em atraso. Data limite: ${format(nextInsp, 'dd/MM/yyyy')}.`
          : `A inspeção do seu veículo vence em ${format(nextInsp, 'dd/MM/yyyy')} (${daysLeft} dias).`,
        type: 'Inspeção',
        due_date: format(nextInsp, 'yyyy-MM-dd'),
        is_read: false,
        is_completed: false,
      });
      created.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, schedule: 'Inspeção IPO' });
    }

    // --- 4. Carta de Condução (user-level, not vehicle-specific) ---
    if (user.license_expiry_date) {
      const expiry = parseISO(user.license_expiry_date);
      const today = new Date();
      const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      // Warn 30 days before or if already expired
      if (daysToExpiry <= 30) {
        const alreadyExists = notifications.some(n =>
          n.type === 'Carta de Condução' &&
          !n.is_completed
        );

        if (!alreadyExists) {
          await base44.entities.Notification.create({
            title: daysToExpiry < 0 ? 'Carta de Condução expirada' : `Carta de Condução expira em ${daysToExpiry} dias`,
            message: daysToExpiry < 0
              ? `A tua carta de condução expirou em ${format(expiry, 'dd/MM/yyyy')}. Renova o mais breve possível.`
              : `A tua carta de condução expira em ${format(expiry, 'dd/MM/yyyy')}.`,
            type: 'Carta de Condução',
            due_date: user.license_expiry_date,
            is_read: false,
            is_completed: false,
          });
          created.push({ vehicle: 'Carta de Condução', schedule: 'Renovação de Carta' });
        }
      }
    }

    return Response.json({ status: 'success', notifications_created: created.length, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});