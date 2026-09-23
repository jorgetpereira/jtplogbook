import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const currentDay = now.getDate();

    // Find all vehicles with a loan_amount > 0
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const loanVehicles = vehicles.filter((v) => v.loan_amount && v.loan_amount > 0);

    if (loanVehicles.length === 0) {
      return Response.json({ success: true, message: "No vehicles with active loans." });
    }

    const results = [];

    for (const vehicle of loanVehicles) {
      try {
        // Get all loan expenses for this vehicle
        const loanExpenses = await base44.asServiceRole.entities.Expense.filter({
          vehicle_id: vehicle.id,
          category: "Empréstimos"
        }, "-date", 500);

        if (loanExpenses.length === 0) {
          results.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, skipped: "No previous loan expenses found." });
          continue;
        }

        const totalLoan = Number(vehicle.loan_amount);
        const totalPaid = loanExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const remaining = totalLoan - totalPaid;

        if (remaining <= 0) {
          results.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, skipped: "Loan fully paid off." });
          continue;
        }

        // Use the most recent loan expense as template
        const template = loanExpenses[0];
        const monthlyAmount = Number(template.amount) || 0;

        if (monthlyAmount <= 0) {
          results.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, skipped: "Could not determine monthly amount." });
          continue;
        }

        // Check if a payment already exists for this month (same year-month)
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed
        const expectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-27`;

        const alreadyExists = loanExpenses.some(e => e.date === expectedDate);
        if (alreadyExists) {
          results.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, skipped: `Payment for ${expectedDate} already exists.` });
          continue;
        }

        // Determine payment amount: monthly or partial (final)
        const paymentAmount = remaining >= monthlyAmount ? monthlyAmount : remaining;

        const newExpense = await base44.asServiceRole.entities.Expense.create({
          owner_id: vehicle.created_by_id,
          vehicle_id: vehicle.id,
          category: "Empréstimos",
          sub_category: template.sub_category || "Crédito",
          amount: Number(paymentAmount.toFixed(2)),
          date: expectedDate,
          location: template.location || undefined,
          description: template.description || undefined,
        });

        const newRemaining = remaining - paymentAmount;

        results.push({
          vehicle: `${vehicle.brand} ${vehicle.model}`,
          created: { id: newExpense.id, date: expectedDate, amount: paymentAmount },
          remaining: Number(newRemaining.toFixed(2)),
          paidOff: newRemaining <= 0
        });

      } catch (e) {
        results.push({ vehicle: `${vehicle.brand} ${vehicle.model}`, error: e.message });
      }
    }

    return Response.json({ success: true, date: now.toISOString(), results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}