import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { addMonths, format, parseISO } from 'npm:date-fns@3.6.0';

function buildRawEmail(to: string, subject: string, htmlBody: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const raw = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Use user-scoped calls so RLS filters to only the authenticated user's data
    const [vehicles, expenses, schedules] = await Promise.all([
      base44.entities.Vehicle.list(),
      base44.entities.Expense.list('-date', 1000),
      base44.entities.MaintenanceSchedule.filter({ is_active: true }),
    ]);

    const alerts: any[] = [];

    // --- Check km-based schedules ---
    for (const schedule of schedules) {
      if (!schedule.interval_km || !schedule.last_done_km || !schedule.vehicle_id) continue;

      const vehicle = vehicles.find(v => v.id === schedule.vehicle_id);
      if (!vehicle) continue;

      const vExp = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense);
      const currentKm = vExp.length > 0
        ? Math.max(...vExp.map(e => e.mileage_at_expense))
        : vehicle.mileage || 0;

      const nextKm = schedule.last_done_km + schedule.interval_km;
      const warningKm = schedule.warning_km || 500;
      const remaining = nextKm - currentKm;

      if (remaining <= warningKm) {
        alerts.push({
          vehicle: `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`,
          schedule: schedule.name,
          currentKm: Math.round(currentKm),
          nextKm,
          remaining: Math.max(0, Math.round(remaining)),
          type: 'km',
          urgent: remaining <= 0,
        });
      }
    }

    // --- Check date-based schedules ---
    for (const schedule of schedules) {
      if (!schedule.interval_months || !schedule.last_done_date || !schedule.vehicle_id) continue;

      const vehicle = vehicles.find(v => v.id === schedule.vehicle_id);
      if (!vehicle) continue;

      const lastDate = parseISO(schedule.last_done_date);
      const next = addMonths(lastDate, schedule.interval_months);
      const today = new Date();
      const daysLeft = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 30) {
        alerts.push({
          vehicle: `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`,
          schedule: schedule.name,
          nextDate: format(next, 'dd/MM/yyyy'),
          daysLeft,
          type: 'date',
          urgent: daysLeft <= 7,
        });
      }
    }

    // --- Legacy: vehicles without schedules ---
    const vehiclesWithSchedules = new Set(schedules.map(s => s.vehicle_id));
    for (const vehicle of vehicles) {
      if (!vehicle.is_active || vehiclesWithSchedules.has(vehicle.id)) continue;
      const vExp = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense);
      const latestKm = vExp.length > 0 ? Math.max(...vExp.map(e => e.mileage_at_expense)) : vehicle.mileage || 0;
      if (!latestKm || latestKm < 500) continue;

      const INTERVAL = 15000;
      const WARNING = 500;
      const nextMilestone = Math.ceil(latestKm / INTERVAL) * INTERVAL;
      const remaining = nextMilestone - latestKm;
      if (remaining <= WARNING) {
        alerts.push({
          vehicle: `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`,
          schedule: 'Revisão periódica',
          currentKm: Math.round(latestKm),
          nextKm: nextMilestone,
          remaining: Math.max(0, Math.round(remaining)),
          type: 'km',
          urgent: remaining <= 0,
        });
      }
    }

    if (alerts.length === 0) {
      return Response.json({ sent: false, message: 'Sem alertas de manutenção neste momento.' });
    }

    // Build email rows
    const rows = alerts.map(a => {
      const color = a.urgent ? '#e53e3e' : '#dd6b20';
      const detail = a.type === 'km'
        ? `Atual: ${a.currentKm.toLocaleString('pt-PT')} km → Próxima: ${a.nextKm.toLocaleString('pt-PT')} km (restam ${a.remaining.toLocaleString('pt-PT')} km)`
        : `Data limite: ${a.nextDate} (restam ${a.daysLeft} dia${a.daysLeft !== 1 ? 's' : ''})`;
      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;">${a.vehicle}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:600;">${a.schedule}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:${color};font-size:12px;">${detail}</td>
      </tr>`;
    }).join('');

    const htmlBody = `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1a202c;">
  <div style="background:linear-gradient(135deg,#f56565,#c05621);padding:28px;border-radius:12px 12px 0 0;color:white;">
    <h2 style="margin:0;font-size:22px;">🔧 Alertas de Manutenção</h2>
    <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">
      ${alerts.length} intervenção${alerts.length !== 1 ? 'ões' : ''} necessária${alerts.length !== 1 ? 's' : ''}
    </p>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#edf2f7;">
          <th style="padding:8px 14px;text-align:left;color:#718096;">Veículo</th>
          <th style="padding:8px 14px;text-align:left;color:#718096;">Manutenção</th>
          <th style="padding:8px 14px;text-align:left;color:#718096;">Estado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#a0aec0;margin-top:16px;text-align:center;">O Meu Logbook · Gestão de veículos</p>
  </div>
</div>`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const rawEmail = buildRawEmail(
      user.email,
      `🔧 ${alerts.length} alerta${alerts.length !== 1 ? 's' : ''} de manutenção — O Meu Logbook`,
      htmlBody,
    );

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEmail }),
    });

    if (!gmailRes.ok) {
      const err = await gmailRes.text();
      return Response.json({ error: `Gmail error: ${err}` }, { status: 500 });
    }

    return Response.json({ sent: true, alerts: alerts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});