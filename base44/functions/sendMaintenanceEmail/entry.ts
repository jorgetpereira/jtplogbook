import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { notification_id } = await req.json();

    let notification;
    if (notification_id) {
      const results = await base44.asServiceRole.entities.Notification.filter({ id: notification_id });
      notification = results[0];
    }

    // If no specific notification, send a digest of all pending ones due in next 7 days
    const notifications = notification
      ? [notification]
      : await base44.asServiceRole.entities.Notification.filter({ is_completed: false });

    const today = new Date();
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcoming = notifications.filter(n => {
      const due = new Date(n.due_date);
      return due >= today && due <= in7days;
    });

    if (upcoming.length === 0) {
      return Response.json({ message: 'No upcoming notifications to send.' });
    }

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

    const rows = upcoming.map(n => {
      const v = vehicleMap[n.vehicle_id];
      const vName = v ? `${v.brand} ${v.model} (${v.license_plate})` : 'Veículo desconhecido';
      const daysLeft = Math.ceil((new Date(n.due_date) - today) / (1000 * 60 * 60 * 24));
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${n.title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${n.type}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${vName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${daysLeft <= 2 ? '#e53e3e' : '#dd6b20'}"><strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong></td>
      </tr>`;
    }).join('');

    const body = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a202c;">
  <div style="background:linear-gradient(135deg,#4299e1,#3182ce);padding:24px;border-radius:12px 12px 0 0;color:white;">
    <h2 style="margin:0;font-size:20px;">🚗 O Meu Logbook — Lembretes</h2>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">Tens ${upcoming.length} lembrete${upcoming.length !== 1 ? 's' : ''} para os próximos 7 dias</p>
  </div>
  <div style="background:#f7fafc;padding:20px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#edf2f7;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;">Título</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;">Tipo</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;">Veículo</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#718096;">Em</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p style="text-align:center;font-size:11px;color:#a0aec0;margin-top:12px;">O Meu Logbook · Gestão de veículos</p>
</div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject: `🔔 ${upcoming.length} lembrete${upcoming.length !== 1 ? 's' : ''} nos próximos 7 dias — O Meu Logbook`,
      body,
      from_name: "O Meu Logbook",
    });

    return Response.json({ sent: true, count: upcoming.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});