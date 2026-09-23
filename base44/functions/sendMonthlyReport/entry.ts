import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Build RFC 2822 email with CSV attachment
function buildMimeEmail(to: string, subject: string, htmlBody: string, csvContent: string, csvFilename: string): string {
  const boundary = `boundary_${Date.now()}`;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const encodedCsv = btoa(unescape(encodeURIComponent(csvContent)));

  const raw = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/csv; charset=UTF-8; name="${csvFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${csvFilename}"`,
    ``,
    encodedCsv,
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse request body for optional dry_run flag
    let dryRun = false;
    try {
      const body = await req.clone().json();
      dryRun = !!body?.dry_run;
    } catch { /* no body or not JSON — normal invocation from scheduler */ }

    if (dryRun) {
      // Health check: just verify the Gmail connection works, don't send anything
      try {
        await base44.asServiceRole.connectors.getConnection('gmail');
        return Response.json({ ok: true, dry_run: true, connected: true });
      } catch {
        return Response.json({ ok: false, dry_run: true, connected: false }, { status: 503 });
      }
    }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const monthLabel = lastMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    // Use user-scoped calls so RLS filters to only the authenticated user's data
    const [expenses, vehicles] = await Promise.all([
      base44.entities.Expense.list('-date', 1000),
      base44.entities.Vehicle.list(),
    ]);

    // Filter to last month
    const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(monthStr));

    if (monthExpenses.length === 0) {
      return Response.json({ message: 'Sem despesas no mês anterior.' });
    }

    // Aggregate by vehicle
    const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));
    const byVehicle: Record<string, any> = {};

    for (const e of monthExpenses) {
      if (!byVehicle[e.vehicle_id]) {
        const v = vehicleMap[e.vehicle_id];
        byVehicle[e.vehicle_id] = {
          name: v ? `${v.brand} ${v.model}` : 'Desconhecido',
          plate: v?.license_plate || '-',
          fuelCost: 0,
          maintenanceCost: 0,
          totalCost: 0,
          liters: 0,
        };
      }
      const agg = byVehicle[e.vehicle_id];
      agg.totalCost += e.amount || 0;
      if (e.category === 'Combustível') agg.fuelCost += e.amount || 0;
      else agg.maintenanceCost += e.amount || 0;
      if (e.liters) agg.liters += e.liters;
    }

    // Build CSV
    const csvRows = [
      ['Veículo', 'Matrícula', 'Combustível (€)', 'Manutenção (€)', 'Total (€)', 'Litros/kWh', 'km Percorridos'],
    ];

    let grandTotal = 0;
    let grandFuel = 0;
    let grandMaint = 0;

    const vehicleRows: string[][] = [];
    for (const [vId, agg] of Object.entries(byVehicle)) {
      // km driven in the month = (last reading in month) - (last reading before month)
      const vReadings = expenses
        .filter(e => e.vehicle_id === vId && e.mileage_at_expense)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          return (a.mileage_at_expense || 0) - (b.mileage_at_expense || 0);
        });
      let startKm: number | null = null;
      let endKm: number | null = null;
      for (const e of vReadings) {
        if (e.date < monthStr) startKm = e.mileage_at_expense;
        else if (e.date.startsWith(monthStr)) endKm = e.mileage_at_expense;
      }
      const kmDriven = (startKm != null && endKm != null) ? endKm - startKm : 0;
      grandTotal += agg.totalCost;
      grandFuel += agg.fuelCost;
      grandMaint += agg.maintenanceCost;
      vehicleRows.push([
        agg.name,
        agg.plate,
        agg.fuelCost.toFixed(2),
        agg.maintenanceCost.toFixed(2),
        agg.totalCost.toFixed(2),
        agg.liters > 0 ? agg.liters.toFixed(2) : '-',
        kmDriven > 0 ? String(Math.round(kmDriven)) : '-',
      ]);
    }

    vehicleRows.sort((a, b) => Number(b[4]) - Number(a[4]));
    csvRows.push(...vehicleRows);
    csvRows.push(['TOTAL', '', grandFuel.toFixed(2), grandMaint.toFixed(2), grandTotal.toFixed(2), '', '']);

    const csvContent = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const csvFilename = `logbook_${monthStr}.csv`;

    // Build HTML summary rows
    const tableRows = vehicleRows.map(r => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${r[0]}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${r[1]}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${r[2]} €</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${r[3]} €</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${r[4]} €</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${r[6]} km</td>
      </tr>`).join('');

    const htmlBody = `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1a202c;">
  <div style="background:linear-gradient(135deg,#4f6ef7,#7c3aed);padding:28px;border-radius:12px 12px 0 0;color:white;">
    <h2 style="margin:0;font-size:22px;">🚗 O Meu Logbook</h2>
    <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">Resumo de ${monthLabel} · ${Object.keys(byVehicle).length} veículo(s)</p>
  </div>
  <div style="background:#f7fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#edf2f7;">
          <th style="padding:8px 12px;text-align:left;color:#718096;">Veículo</th>
          <th style="padding:8px 12px;text-align:left;color:#718096;">Matrícula</th>
          <th style="padding:8px 12px;text-align:right;color:#718096;">Combustível</th>
          <th style="padding:8px 12px;text-align:right;color:#718096;">Manutenção</th>
          <th style="padding:8px 12px;text-align:right;color:#718096;">Total</th>
          <th style="padding:8px 12px;text-align:right;color:#718096;">km</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#edf2f7;font-weight:700;">
          <td colspan="2" style="padding:8px 12px;">TOTAL</td>
          <td style="padding:8px 12px;text-align:right;">${grandFuel.toFixed(2)} €</td>
          <td style="padding:8px 12px;text-align:right;">${grandMaint.toFixed(2)} €</td>
          <td style="padding:8px 12px;text-align:right;">${grandTotal.toFixed(2)} €</td>
          <td style="padding:8px 12px;text-align:right;"></td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:12px;color:#a0aec0;margin-top:16px;text-align:center;">Folha de cálculo em anexo · O Meu Logbook</p>
  </div>
</div>`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const rawEmail = buildMimeEmail(
      user.email,
      `📊 Resumo ${monthLabel} — O Meu Logbook`,
      htmlBody,
      csvContent,
      csvFilename,
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

    return Response.json({ sent: true, month: monthLabel, vehicles: Object.keys(byVehicle).length, total: grandTotal.toFixed(2) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});