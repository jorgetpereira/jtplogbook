import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth, addMonths,
  isPast, isToday, differenceInDays, parseISO
} from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Wrench, Bell, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const TYPE_COLORS = {
  "Revisão": { dot: "bg-blue-500", chip: "bg-blue-100 text-blue-700 border-blue-200" },
  "Seguro": { dot: "bg-purple-500", chip: "bg-purple-100 text-purple-700 border-purple-200" },
  "Inspeção": { dot: "bg-green-500", chip: "bg-green-100 text-green-700 border-green-200" },
  "IUC": { dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  "Pneus": { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700 border-amber-200" },
  "Outro": { dot: "bg-gray-500", chip: "bg-gray-100 text-gray-700 border-gray-200" },
};

function getColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS["Outro"];
}

/**
 * Build a unified list of calendar events from:
 * - notifications (date-based reminders with due_date)
 * - maintenanceSchedules (km+months based; next date = last_done_date + interval_months)
 */
function buildEvents(notifications, maintenanceSchedules, vehicles) {
  const vehicleMap = Object.fromEntries((vehicles || []).map(v => [v.id, v]));
  const events = [];

  // Notifications → direct events
  notifications.forEach(n => {
    if (!n.due_date) return;
    events.push({
      id: `notif-${n.id}`,
      date: parseISO(n.due_date),
      title: n.title,
      type: n.type || "Outro",
      vehicle: vehicleMap[n.vehicle_id],
      source: "notification",
      isCompleted: n.is_completed,
      message: n.message,
    });
  });

  // Maintenance schedules → projected next due date
  maintenanceSchedules.forEach(s => {
    if (!s.is_active) return;
    if (!s.last_done_date || !s.interval_months) return;
    const base = parseISO(s.last_done_date);
    // Project forward to the next occurrence after today
    let next = addMonths(base, s.interval_months);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (next < today) {
      next = addMonths(next, s.interval_months);
    }
    events.push({
      id: `sched-${s.id}`,
      date: next,
      title: s.name,
      type: "Revisão",
      vehicle: vehicleMap[s.vehicle_id],
      source: "schedule",
      intervalKm: s.interval_km,
      intervalMonths: s.interval_months,
    });
  });

  return events;
}

export default function MaintenanceCalendar({ notifications, maintenanceSchedules, vehicles }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const events = useMemo(
    () => buildEvents(notifications, maintenanceSchedules, vehicles),
    [notifications, maintenanceSchedules, vehicles]
  );

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const key = format(ev.date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Events in the current month only (not spillover days from adjacent months)
  const monthEvents = useMemo(() => {
    return events
      .filter(ev => isSameMonth(ev.date, currentMonth))
      .sort((a, b) => a.date - b.date);
  }, [events, currentMonth]);

  // Selected day events (from all events, including spillover days) or all month events
  const visibleEvents = selectedDate
    ? events.filter(ev => isSameDay(ev.date, selectedDate))
    : monthEvents;

  const prevMonth = () => { setCurrentMonth(m => addMonths(m, -1)); setSelectedDate(null); };
  const nextMonth = () => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); };

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-3 card-shadow">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-base capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: pt })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {monthEvents.length} manutenção{monthEvents.length !== 1 ? "ões" : ""} este mês
          </p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-2xl border border-border p-3 card-shadow">
        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-muted-foreground uppercase">
              {d}
            </div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay[key] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const todayFlag = isToday(day);
            const hasOverdue = dayEvents.some(ev =>
              !ev.isCompleted && isPast(ev.date) && !isToday(ev.date)
            );
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative",
                  !inMonth && "opacity-30",
                  isSelected ? "bg-primary text-primary-foreground shadow-md" :
                  todayFlag ? "bg-primary/10 ring-2 ring-primary/40" :
                  dayEvents.length > 0 ? "hover:bg-muted" : "hover:bg-muted/50",
                  hasOverdue && !isSelected && !todayFlag && "bg-red-50 dark:bg-red-500/10"
                )}
              >
                <span className={cn(
                  "text-xs font-semibold",
                  isSelected ? "text-primary-foreground" :
                  todayFlag ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center max-w-[80%]">
                    {dayEvents.slice(0, 3).map(ev => (
                      <span
                        key={ev.id}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isSelected ? "bg-primary-foreground" : getColor(ev.type).dot
                        )}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className={cn(
                        "text-[8px] font-bold leading-none",
                        isSelected ? "text-primary-foreground" : "text-muted-foreground"
                      )}>
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-full", c.dot)} />
            <span className="text-[11px] text-muted-foreground">{type}</span>
          </div>
        ))}
      </div>

      {/* Event list for selected day / month */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {selectedDate
              ? format(selectedDate, "d 'de' MMMM", { locale: pt })
              : "Este mês"}
          </h3>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-[11px] text-primary font-medium hover:underline"
            >
              Ver todo o mês
            </button>
          )}
        </div>

        {visibleEvents.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm card-shadow">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {selectedDate
              ? "Sem manutenções neste dia."
              : "Sem manutenções agendadas este mês."}
          </div>
        ) : (
          visibleEvents.map(ev => {
            const overdue = !ev.isCompleted && isPast(ev.date) && !isToday(ev.date);
            const daysLeft = differenceInDays(ev.date, new Date());
            const color = getColor(ev.type);

            return (
              <div
                key={ev.id}
                className={cn(
                  "bg-card rounded-2xl border p-3.5 card-shadow",
                  overdue ? "border-destructive/40 bg-destructive/5" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      ev.source === "schedule" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {ev.source === "schedule" ? <Wrench className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-semibold text-sm",
                          ev.isCompleted && "line-through text-muted-foreground"
                        )}>
                          {ev.title}
                        </span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", color.chip)}>
                          {ev.type}
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Vencida
                          </span>
                        )}
                      </div>
                      {ev.vehicle && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {ev.vehicle.license_plate && (
                            <span className="font-mono text-[10px] font-bold bg-secondary border border-border px-1.5 py-0.5 rounded-md tracking-widest">
                              {ev.vehicle.license_plate}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {ev.vehicle.brand} {ev.vehicle.model}
                          </span>
                        </div>
                      )}
                      {ev.message && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 italic truncate">{ev.message}</p>
                      )}
                      {ev.source === "schedule" && ev.intervalKm && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Também a cada {ev.intervalKm.toLocaleString()} km
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold capitalize">
                      {format(ev.date, "d MMM", { locale: pt })}
                    </p>
                    {!ev.isCompleted && !overdue && daysLeft <= 30 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5 bg-amber-50 text-amber-700">
                        {daysLeft === 0 ? "Hoje" : `${daysLeft} dias`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}