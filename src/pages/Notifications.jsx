import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Plus, Check, Trash2, Clock, Download, CalendarPlus, Sparkles, Gauge, CalendarDays, Pencil, Calendar, CalendarCheck } from "lucide-react";
import { maybeCreateAutoNotification } from "@/lib/autoNotifications";
import { downloadOrShareICal, buildEventDescription } from "@/lib/icsExport";
import { syncNotificationToCalendar } from "@/lib/calendarSync";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NotificationForm from "../components/notifications/NotificationForm";
import MaintenanceScheduleManager from "../components/notifications/MaintenanceScheduleManager";
import MaintenanceCalendar from "../components/notifications/MaintenanceCalendar";
import { format, isPast, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotif, setEditingNotif] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("lembretes");
  const [schedules, setSchedules] = useState([]);

  const generateFromHistory = async () => {
    setGenerating(true);
    const [expenses] = await Promise.all([
      base44.entities.Expense.list("-date", 500),
    ]);
    // Process oldest first so newer ones override (duplicate check is date-aware)
    const sorted = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const exp of sorted) {
      await maybeCreateAutoNotification(exp, true);
    }
    await load();
    setGenerating(false);
    alert("Alertas gerados com base no histórico de despesas.");
  };

  const load = async () => {
    const [n, v, s] = await Promise.all([
      base44.entities.Notification.list("-due_date"),
      base44.entities.Vehicle.list(),
      base44.entities.MaintenanceSchedule.list()
    ]);
    setNotifications(n);
    setVehicles(v);
    setSchedules(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const handleSave = async (data) => {
    const created = await base44.entities.Notification.create(data);
    setDialogOpen(false);
    try {
      const vehicle = vehicleMap[data.vehicle_id];
      const res = await syncNotificationToCalendar('create', { ...data, ...created }, vehicle);
      if (res?.event_id) {
        await base44.entities.Notification.update(created.id, { calendar_event_id: res.event_id });
      }
    } catch (e) { console.warn('Calendar sync failed:', e); }
    load();
  };

  const handleEditSave = async (data) => {
    await base44.entities.Notification.update(editingNotif.id, data);
    try {
      const vehicle = vehicleMap[data.vehicle_id];
      const res = await syncNotificationToCalendar('update', { ...editingNotif, ...data }, vehicle);
      if (res?.event_id && res.event_id !== editingNotif.calendar_event_id) {
        await base44.entities.Notification.update(editingNotif.id, { calendar_event_id: res.event_id });
      }
    } catch (e) { console.warn('Calendar sync failed:', e); }
    setEditingNotif(null);
    load();
  };

  const toggleComplete = async (notif) => {
    await base44.entities.Notification.update(notif.id, { is_completed: !notif.is_completed });
    load();
  };

  const handleDelete = async (notif) => {
    try {
      const vehicle = vehicleMap[notif.vehicle_id];
      await syncNotificationToCalendar('delete', notif, vehicle);
    } catch (e) { console.warn('Calendar sync failed:', e); }
    await base44.entities.Notification.delete(notif.id);
    load();
  };

  const syncAllToCalendar = async () => {
    setSyncing(true);
    const toSync = notifications.filter(n => !n.is_completed);
    if (toSync.length === 0) {
      alert("Não há lembretes pendentes para sincronizar.");
      setSyncing(false);
      return;
    }
    let synced = 0;
    for (const notif of toSync) {
      try {
        const vehicle = vehicleMap[notif.vehicle_id];
        const action = notif.calendar_event_id ? 'update' : 'create';
        const res = await syncNotificationToCalendar(action, notif, vehicle);
        if (res?.event_id) {
          await base44.entities.Notification.update(notif.id, { calendar_event_id: res.event_id });
          synced++;
        }
      } catch (e) { console.warn('Sync failed for', notif.id, e); }
    }
    setSyncing(false);
    await load();
    alert(`${synced} lembrete(s) sincronizado(s) com o Google Calendar.`);
  };

  const exportToICalendar = () => {
    const pending = notifications.filter(n => !n.is_completed);
    const events = pending.map(n => ({
      id: n.id,
      title: n.title,
      due_date: n.due_date,
      description: buildEventDescription(n, vehicleMap[n.vehicle_id]),
    }));
    downloadOrShareICal(events, `lembretes-${new Date().toISOString().split("T")[0]}.ics`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const pending = notifications.filter(n => !n.is_completed);
  const completed = notifications.filter(n => n.is_completed);

  return (
    <div className="flex flex-col min-h-full space-y-5 px-4 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-orange-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 opacity-80" />
              Lembretes
            </h1>
            <p className="text-white/60 text-xs mt-0.5">Alertas e notificações</p>
          </div>
          <div className="flex gap-1">
            <Button onClick={syncAllToCalendar} disabled={syncing} size="sm" className="gap-1 rounded-xl bg-white text-orange-600 hover:bg-white/90 h-9 text-xs font-semibold px-2.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>{syncing ? "Sinc..." : "Sync"}</span>
            </Button>
            <Button onClick={exportToICalendar} size="sm" className="gap-1 rounded-xl bg-white/15 hover:bg-white/25 border-transparent text-white text-xs h-9 px-2.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>.ics</span>
            </Button>
            <Button onClick={generateFromHistory} disabled={generating} size="sm" className="gap-1 rounded-xl bg-white/15 hover:bg-white/25 border-transparent text-white text-xs h-9 px-2.5" title="Gerar alertas a partir do histórico">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{generating ? "A gerar..." : "Auto"}</span>
            </Button>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full gap-2 rounded-xl bg-white text-orange-600 hover:bg-white/90 h-10 text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Novo Lembrete
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1.5">
        <button
          onClick={() => setActiveTab("lembretes")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === "lembretes" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bell className="w-3.5 h-3.5" /> Lembretes
        </button>
        <button
          onClick={() => setActiveTab("calendario")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === "calendario" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CalendarDays className="w-3.5 h-3.5" /> Calendário
        </button>
        <button
          onClick={() => setActiveTab("km")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === "km" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Gauge className="w-3.5 h-3.5" /> Manutenções km
        </button>
      </div>

      {activeTab === "calendario" && (
        <MaintenanceCalendar
          notifications={notifications}
          maintenanceSchedules={schedules}
          vehicles={vehicles}
        />
      )}

      {activeTab === "km" && <MaintenanceScheduleManager vehicles={vehicles} />}

      {activeTab === "lembretes" && <>
      {/* Pending */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Pendentes ({pending.length})
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-10 text-center card-shadow">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Bell className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold text-sm">Sem lembretes pendentes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(notif => (
              <NotifCard key={notif.id} notif={notif} vehicle={vehicleMap[notif.vehicle_id]} onToggle={toggleComplete} onDelete={handleDelete} onEdit={setEditingNotif} />
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">
            Concluídas ({completed.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {completed.map(notif => (
              <NotifCard key={notif.id} notif={notif} vehicle={vehicleMap[notif.vehicle_id]} onToggle={toggleComplete} onDelete={handleDelete} onEdit={setEditingNotif} />
            ))}
          </div>
        </div>
      )}

      </>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lembrete</DialogTitle>
          </DialogHeader>
          <NotificationForm vehicles={vehicles} onSave={handleSave} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNotif} onOpenChange={(open) => { if (!open) setEditingNotif(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lembrete</DialogTitle>
          </DialogHeader>
          {editingNotif && (
            <NotificationForm
              vehicles={vehicles}
              initial={editingNotif}
              onSave={handleEditSave}
              onCancel={() => setEditingNotif(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotifCard({ notif, vehicle, onToggle, onDelete, onEdit }) {
  const overdue = isPast(new Date(notif.due_date)) && !notif.is_completed;
  const daysLeft = differenceInDays(new Date(notif.due_date), new Date());

  const addToCalendar = () => {
    downloadOrShareICal(
      [{ id: notif.id, title: notif.title, due_date: notif.due_date, description: buildEventDescription(notif, vehicle) }],
      `lembrete-${notif.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`
    );
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl border p-4 flex items-center gap-3 card-shadow transition-all duration-200",
      overdue ? "border-destructive/30 bg-destructive/5" : "border-border"
    )}>
      <button
        onClick={() => onToggle(notif)}
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-200",
          notif.is_completed
            ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30"
            : overdue ? "border-destructive/50 hover:border-destructive" : "border-border hover:border-primary"
        )}
      >
        {notif.is_completed && <Check className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm", notif.is_completed && "line-through text-muted-foreground")}>{notif.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {vehicle ? `${vehicle.brand} ${vehicle.model}` : "—"} · {notif.type}
          {notif.message && ` · ${notif.message}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-xs font-semibold", overdue ? "text-destructive" : "text-muted-foreground")}>
          {format(new Date(notif.due_date), "d MMM yyyy", { locale: pt })}
        </p>
        {!notif.is_completed && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5",
            overdue ? "bg-red-50 text-destructive" : daysLeft <= 7 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
          )}>
            {overdue ? "Vencido" : `${daysLeft} dias`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {notif.calendar_event_id ? (
          <div className="h-8 w-8 flex items-center justify-center shrink-0" title="Sincronizado com Google Calendar">
            <CalendarCheck className="w-3.5 h-3.5 text-green-500" />
          </div>
        ) : !notif.is_completed && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={addToCalendar} title="Adicionar ao calendário">
            <CalendarPlus className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={() => onEdit(notif)} title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onDelete(notif)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}