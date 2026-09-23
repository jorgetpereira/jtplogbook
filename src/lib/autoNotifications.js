import { base44 } from "@/api/base44Client";
import { addYears, addMonths, format } from "date-fns";
import { getNextInspectionDate } from "@/lib/inspectionRules";

// Map sub_category → { notifType, dueDateFn, label }
const AUTO_NOTIF_RULES = {
  "Seguro":    { type: "Seguro",    months: 12, label: "Renovação de Seguro" },
  "Inspeção":  { type: "Inspeção",  months: 24, label: "Próxima Inspeção" },
  "IUC":       { type: "IUC",       months: 12, label: "Pagamento de IUC" },
  "Revisão":   { type: "Revisão",   months: 12, label: "Próxima Revisão" },
};

/**
 * After saving an expense, automatically create a Notification reminder
 * if the sub_category has an auto-rule.
 * Skips creation if a non-completed notification of the same type already
 * exists for the same vehicle with a due_date in the future.
 */
export async function maybeCreateAutoNotification(expenseData, isNew) {
  if (!isNew) return; // only on create
  const rule = AUTO_NOTIF_RULES[expenseData.sub_category];
  if (!rule) return;

  const expenseDate = new Date(expenseData.date + "T12:00:00");
  let dueDate;
  if (expenseData.sub_category === "Inspeção") {
    const vehicle = await base44.entities.Vehicle.get(expenseData.vehicle_id);
    if (!vehicle?.year) return;
    dueDate = getNextInspectionDate(vehicle.year, expenseData.date, vehicle.registration_date);
  } else {
    dueDate = addMonths(expenseDate, rule.months);
  }
  const dueDateStr = format(dueDate, "yyyy-MM-dd");

  // Check for existing active notification of same type for same vehicle
  const existing = await base44.entities.Notification.filter({
    vehicle_id: expenseData.vehicle_id,
    type: rule.type,
    is_completed: false,
  });

  // Only skip if there's already one with a future or equal due date
  const alreadyExists = existing.some(n => n.due_date >= dueDateStr);
  if (alreadyExists) return;

  const created = await base44.entities.Notification.create({
    vehicle_id: expenseData.vehicle_id,
    title: rule.label,
    message: `Criado automaticamente a partir do registo de ${expenseData.sub_category} de ${format(expenseDate, "dd/MM/yyyy")}.`,
    type: rule.type,
    due_date: dueDateStr,
    is_read: false,
    is_completed: false,
  });

  // Sync to Google Calendar (best-effort)
  try {
    const res = await base44.functions.invoke("syncCalendarEvent", {
      action: "create",
      title: rule.label,
      due_date: dueDateStr,
      type: rule.type,
      message: created.message,
    });
    if (res?.data?.event_id) {
      await base44.entities.Notification.update(created.id, { calendar_event_id: res.data.event_id });
    }
  } catch (e) {
    console.warn("Calendar sync failed:", e);
  }
}