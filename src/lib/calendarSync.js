import { base44 } from "@/api/base44Client";

/**
 * Syncs a notification to/from Google Calendar via the syncCalendarEvent backend function.
 * Best-effort: returns null on failure so callers can continue without blocking.
 */
export async function syncNotificationToCalendar(action, notif, vehicle) {
  try {
    const res = await base44.functions.invoke("syncCalendarEvent", {
      action,
      title: notif.title,
      due_date: notif.due_date,
      type: notif.type,
      message: notif.message,
      vehicle_name: vehicle ? `${vehicle.brand} ${vehicle.model}` : null,
      existing_event_id: notif.calendar_event_id,
    });
    return res.data;
  } catch (e) {
    console.warn("Calendar sync failed:", e);
    return null;
  }
}