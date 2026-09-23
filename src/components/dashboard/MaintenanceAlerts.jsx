import { AlertTriangle, Wrench, Calendar, Gauge, ChevronRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { addMonths, differenceInDays } from "date-fns";

export default function MaintenanceAlerts({ vehicles, expenses, schedules, notifications }) {
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  // Calculate current mileage per vehicle (max of vehicle.mileage and expense records)
  const vehicleMileage = {};
  vehicles.forEach(v => {
    const maxExpensesKm = expenses
      .filter(e => e.vehicle_id === v.id && e.mileage_at_expense)
      .reduce((max, e) => Math.max(max, e.mileage_at_expense), 0);
    vehicleMileage[v.id] = Math.max(v.mileage || 0, maxExpensesKm);
  });

  const alerts = [];

  // Check MaintenanceSchedule items
  schedules.filter(s => s.is_active !== false).forEach(s => {
    const vehicle = vehicleMap[s.vehicle_id];
    if (!vehicle) return;

    const currentKm = vehicleMileage[s.vehicle_id] || 0;
    const warningKm = s.warning_km || 500;

    // KM-based alert
    if (s.interval_km && s.last_done_km != null) {
      const nextKm = s.last_done_km + s.interval_km;
      const remainingKm = nextKm - currentKm;
      if (remainingKm <= warningKm) {
        alerts.push({
          id: `sched_km_${s.id}`,
          vehicle,
          title: s.name,
          reason: remainingKm <= 0
            ? `Excedido ${Math.abs(remainingKm).toLocaleString()} km`
            : `${remainingKm.toLocaleString()} km restantes`,
          severity: remainingKm <= 0 ? "critical" : "warning",
          type: "km",
          link: `/vehicles/${vehicle.id}`,
        });
      }
    }

    // Date-based alert
    if (s.interval_months && s.last_done_date) {
      const nextDate = addMonths(new Date(s.last_done_date + "T12:00:00"), s.interval_months);
      const daysUntil = differenceInDays(nextDate, new Date());
      if (daysUntil <= 30) {
        // Avoid duplicate if km alert already added for same schedule
        const existing = alerts.find(a => a.id === `sched_date_${s.id}`);
        if (!existing) {
          alerts.push({
            id: `sched_date_${s.id}`,
            vehicle,
            title: s.name,
            reason: daysUntil <= 0
              ? `Atrasado ${Math.abs(daysUntil)} dias`
              : `${daysUntil} dias`,
            severity: daysUntil <= 0 ? "critical" : daysUntil <= 7 ? "warning" : "info",
            type: "date",
            link: `/vehicles/${vehicle.id}`,
          });
        }
      }
    }
  });

  // Check Notifications near due date (not completed)
  notifications.filter(n => !n.is_completed).forEach(n => {
    if (!n.due_date) return;
    const daysUntil = differenceInDays(new Date(n.due_date + "T12:00:00"), new Date());
    if (daysUntil <= 7) {
      const vehicle = n.vehicle_id ? vehicleMap[n.vehicle_id] : null;
      alerts.push({
        id: `notif_${n.id}`,
        vehicle,
        title: n.title,
        reason: daysUntil <= 0
          ? `Atrasado ${Math.abs(daysUntil)} dias`
          : `${daysUntil} dias`,
        severity: daysUntil <= 0 ? "critical" : "warning",
        type: "notification",
        link: "/notifications",
      });
    }
  });

  if (alerts.length === 0) return null;

  // Sort: critical first, then warnings, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
          Alertas de Manutenção
        </span>
      </div>
      {alerts.map(alert => {
        const isCritical = alert.severity === "critical";
        const Icon = alert.type === "km" ? Gauge : alert.type === "date" ? Calendar : Bell;
        return (
          <Link
            key={alert.id}
            to={alert.link}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors active:scale-[0.99] ${
              isCritical
                ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                : alert.severity === "warning"
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isCritical
                ? "bg-red-100 dark:bg-red-900/50"
                : alert.severity === "warning"
                ? "bg-amber-100 dark:bg-amber-900/50"
                : "bg-blue-100 dark:bg-blue-900/50"
            }`}>
              <Icon className={`w-4 h-4 ${
                isCritical ? "text-red-600" : alert.severity === "warning" ? "text-amber-600" : "text-blue-600"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                isCritical ? "text-red-700 dark:text-red-400"
                : alert.severity === "warning" ? "text-amber-700 dark:text-amber-400"
                : "text-blue-700 dark:text-blue-400"
              }`}>
                {alert.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {alert.vehicle ? `${alert.vehicle.brand} ${alert.vehicle.model} · ` : ""}
                {alert.reason}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}