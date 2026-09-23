import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { History, CheckCircle2, BellOff, Wrench, Car, Trash2, Pencil, Check } from "lucide-react";
import { format, isPast } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES = {
  Motor: "bg-red-100 text-red-700",
  Travões: "bg-orange-100 text-orange-700",
  Elétrico: "bg-blue-100 text-blue-700",
  Eletrónica: "bg-purple-100 text-purple-700",
  Pneus: "bg-amber-100 text-amber-700",
  Suspensão: "bg-cyan-100 text-cyan-700",
  Transmissão: "bg-teal-100 text-teal-700",
  "Ar Condicionado": "bg-sky-100 text-sky-700",
  Outro: "bg-gray-100 text-gray-700"
};

const NOTIF_TYPE_STYLES = {
  Revisão: "bg-blue-100 text-blue-700",
  Seguro: "bg-purple-100 text-purple-700",
  Inspeção: "bg-amber-100 text-amber-700",
  IUC: "bg-teal-100 text-teal-700",
  Pneus: "bg-orange-100 text-orange-700",
  Outro: "bg-gray-100 text-gray-700"
};

export default function Historico() {
  const [issues, setIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("avarias");
  const [editingId, setEditingId] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    Promise.all([
      base44.entities.VehicleIssue.filter({ status: "Resolvido" }, "-resolved_date"),
      base44.entities.Notification.list("-due_date"),
      base44.entities.Vehicle.list()
    ]).then(([i, n, v]) => {
      setIssues(i);
      setNotifications(n);
      setVehicles(v);
      setLoading(false);
    });
  }, []);

  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const handleDeleteIssue = async (id) => {
    await base44.entities.VehicleIssue.delete(id);
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  const startEdit = (issue) => {
    setEditingId(issue.id);
    setEditNotes(issue.resolved_notes || "");
    setEditDate(issue.resolved_date || format(new Date(), "yyyy-MM-dd"));
  };

  const saveEdit = async (issue) => {
    await base44.entities.VehicleIssue.update(issue.id, {
      resolved_notes: editNotes.trim() || undefined,
      resolved_date: editDate || undefined,
    });
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, resolved_notes: editNotes.trim() || undefined, resolved_date: editDate || undefined } : i));
    setEditingId(null);
  };

  const completedNotifs = notifications.filter(n => n.is_completed);
  const expiredNotifs = notifications.filter(n => !n.is_completed && isPast(new Date(n.due_date)));
  const historyNotifs = [...completedNotifs, ...expiredNotifs].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full space-y-5 px-4 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-green-700 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-emerald-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 opacity-80" />
          Histórico
        </h1>
        <p className="text-white/60 text-xs mt-0.5">Avarias resolvidas e lembretes concluídos ou expirados</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1.5">
        <button
          onClick={() => setTab("avarias")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all", tab === "avarias" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Wrench className="w-3.5 h-3.5" /> Avarias ({issues.length})
        </button>
        <button
          onClick={() => setTab("lembretes")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all", tab === "lembretes" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <BellOff className="w-3.5 h-3.5" /> Lembretes ({historyNotifs.length})
        </button>
      </div>

      {tab === "avarias" && (
        issues.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-14 text-center card-shadow">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold text-sm">Sem avarias resolvidas</p>
            <p className="text-muted-foreground text-xs mt-1">As avarias marcadas como resolvidas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map(issue => {
              const vehicle = vehicleMap[issue.vehicle_id];
              return (
                <div key={issue.id} className="bg-card border border-border rounded-2xl p-4 card-shadow">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", CATEGORY_STYLES[issue.category] || CATEGORY_STYLES.Outro)}>
                        {issue.category}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Resolvido
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(issue)} className="text-muted-foreground hover:text-primary p-1" title="Editar resolução">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm("Eliminar este registo?")) handleDeleteIssue(issue.id); }} className="text-muted-foreground hover:text-destructive p-1" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-sm">{issue.title}</p>
                  {vehicle && (
                    <Link to={`/vehicles/${vehicle.id}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1">
                      <Car className="w-3 h-3" /> {vehicle.brand} {vehicle.model}
                    </Link>
                  )}
                  {issue.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-2 mt-2">{issue.notes}</p>}
                  {issue.image_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {issue.image_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                    {issue.detected_date && <span>Deteção: {format(new Date(issue.detected_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</span>}
                    {issue.resolved_date && <span className="text-green-600 font-medium">Resolvido: {format(new Date(issue.resolved_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</span>}
                  </div>
                  {editingId === issue.id ? (
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-xs font-medium">Data de resolução</label>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Notas da reparação</label>
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="O que foi feito..." rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="flex-1 h-8 rounded-md border border-input text-xs font-medium hover:bg-accent">Cancelar</button>
                        <button onClick={() => saveEdit(issue)} className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-primary/90">
                          <Check className="w-3.5 h-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : issue.resolved_notes ? (
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap bg-green-50 rounded-lg p-2 mt-2">
                      <span className="font-semibold">Reparação: </span>{issue.resolved_notes}
                    </p>
                  ) : (
                    <button onClick={() => startEdit(issue)} className="text-xs text-primary hover:underline mt-2">Adicionar notas de reparação</button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "lembretes" && (
        historyNotifs.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-14 text-center card-shadow">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <BellOff className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold text-sm">Sem lembretes no histórico</p>
            <p className="text-muted-foreground text-xs mt-1">Lembretes concluídos ou expirados aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyNotifs.map(notif => {
              const vehicle = vehicleMap[notif.vehicle_id];
              const isExpired = !notif.is_completed && isPast(new Date(notif.due_date));
              return (
                <div key={notif.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 card-shadow">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    notif.is_completed ? "bg-primary/15 text-primary" : "bg-amber-100 text-amber-600"
                  )}>
                    {notif.is_completed ? <CheckCircle2 className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm", notif.is_completed && "line-through text-muted-foreground")}>{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      <span className={cn("inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-1", NOTIF_TYPE_STYLES[notif.type] || NOTIF_TYPE_STYLES.Outro)}>
                        {notif.type}
                      </span>
                      {vehicle ? `${vehicle.brand} ${vehicle.model}` : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{format(new Date(notif.due_date), "d MMM yyyy", { locale: pt })}</p>
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5",
                      notif.is_completed ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                    )}>
                      {notif.is_completed ? "Concluído" : "Expirado"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}