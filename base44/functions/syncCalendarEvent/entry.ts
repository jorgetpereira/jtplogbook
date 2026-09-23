import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, title, due_date, type, message, vehicle_name, existing_event_id } = body;

    // Get Google Calendar OAuth token (SHARED connector — builder's account)
    let accessToken;
    try {
      const tokenData = await base44.asServiceRole.connectors.getConnection("googlecalendar");
      accessToken = tokenData.accessToken;
    } catch (e) {
      return Response.json({ error: 'Google Calendar não ligado', not_connected: true }, { status: 200 });
    }

    const authHeader = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    // Build event description
    const desc = [`Tipo: ${type || 'Manutenção'}`];
    if (vehicle_name) desc.push(`Viatura: ${vehicle_name}`);
    if (message) desc.push(`Notas: ${message}`);
    desc.push('Criado pelo O Meu Logbook');

    // All-day event: start = due_date, end = next day
    const endDate = new Date(due_date + "T12:00:00");
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    const buildEventBody = () => ({
      summary: `🔧 ${title}`,
      description: desc.join('\n'),
      start: { date: due_date },
      end: { date: endDateStr },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 28 * 24 * 60 },
          { method: 'email', minutes: 15 * 24 * 60 },
          { method: 'email', minutes: 7 * 24 * 60 },
        ],
      },
    });

    if (action === 'create') {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(buildEventBody()),
      });
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: 'Falha ao criar evento', details: err }, { status: 500 });
      }
      const event = await res.json();
      return Response.json({ event_id: event.id, success: true });

    } else if (action === 'update') {
      if (!existing_event_id) {
        // No existing event — create one
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(buildEventBody()),
        });
        if (!res.ok) return Response.json({ error: 'Falha ao criar evento' }, { status: 500 });
        const event = await res.json();
        return Response.json({ event_id: event.id, success: true });
      }

      const res = await fetch(`${apiUrl}/${existing_event_id}`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify(buildEventBody()),
      });
      if (!res.ok) {
        // Event may have been deleted from calendar — try creating a new one
        if (res.status === 404 || res.status === 410) {
          const createRes = await fetch(apiUrl, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify(buildEventBody()),
          });
          if (createRes.ok) {
            const event = await createRes.json();
            return Response.json({ event_id: event.id, success: true });
          }
        }
        return Response.json({ error: 'Falha ao atualizar evento' }, { status: 500 });
      }
      const event = await res.json();
      return Response.json({ event_id: event.id, success: true });

    } else if (action === 'delete') {
      if (!existing_event_id) return Response.json({ success: true });
      await fetch(`${apiUrl}/${existing_event_id}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}