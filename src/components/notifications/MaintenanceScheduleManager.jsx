import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Pencil, Check, X, Gauge, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_SCHEDULES = [
  { name: "Revisão / Óleo", interval_km: 15000, interval_months: 12, warning_km: 500 },
  { name: "Filtro de Ar",   interval_km: 30000, interval_months: 24, warning_km: 1000 },
  { name: "Pneus",          interval_km: 40000, interval_months: null, warning_km: 2000 },
  { name: "Travões",        interval_km: 50000, interval_months: null, warning_km: 2000 },
  { name: "Correia / Corrente", interval_km: 120000, interval_months: 60, warning_km: 3000 },
];

function ScheduleForm({ vehicles, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    vehicle_id: vehicles[0]?.id || "",
    name: "",
    interval_km: "",
    interval_months: "",
    warning_km: 500,
    last_done_km: "",
    last_done_date: "",
    is_active: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      interval_km: form.interval_km ? Number(form.interval_km) : undefined,
      interval_months: form.interval_months ? Number(form.interval_months) : undefined,
      warning_km: form.warning_km ? Number(form.warning_km) : 500,
      last_done_km: form.last_done_km ? Number(form.last_done_km) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-muted/40 rounded-2xl p-4 border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Veículo *</Label>
          <Select value={form.vehicle_id} onValueChange={v => set("vehicle_id", v)}>
            <SelectTrigger className="h-9 text-sm rounded-xl">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Nome da Manutenção *</Label>
          <div className="flex gap-2">
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Ex: Revisão / Óleo"
              required
              className="h-9 text-sm rounded-xl flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {DEFAULT_SCHEDULES.map(d => (
              <button
                key={d.name}
                type="button"
                onClick={() => setForm(f => ({ ...f, name: d.name, interval_km: d.interval_km || "", interval_months: d.interval_months || "", warning_km: d.warning_km }))}
                className="text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border hover:bg-accent transition-colors"
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Intervalo (km)</Label>
          <Input type="number" value={form.interval_km} onChange={e => set("interval_km", e.target.value)} placeholder="Ex: 15000" className="h-9 text-sm rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Intervalo (meses)</Label>
          <Input type="number" value={form.interval_months} onChange={e => set("interval_months", e.target.value)} placeholder="Ex: 12" className="h-9 text-sm rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Aviso antecipado (km)</Label>
          <Input type="number" value={form.warning_km} onChange={e => set("warning_km", e.target.value)} placeholder="500" className="h-9 text-sm rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Última realização (km)</Label>
          <Input type="number" value={form.last_done_km} onChange={e => set("last_done_km", e.target.value)} placeholder="Ex: 45000" className="h-9 text-sm rounded-xl" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Última realização (data)</Label>
          <Input type="date" value={form.last_done_date} onChange={e => set("last_done_date", e.target.value)} className="h-9 text-sm rounded-xl" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 rounded-xl">Cancelar</Button>
        <Button type="submit" size="sm" className="flex-1 rounded-xl">Guardar</Button>
      </div>
    </form>
  );
}

function ScheduleCard({ schedule, vehicle, currentKm, onEdit, onDelete }) {
  const hasLastKm = schedule.last_done_km != null;
  const nextKm = hasLastKm && schedule.interval_km != null
    ? schedule.last_done_km + schedule.interval_km
    : null;
  const kmLeft = nextKm != null && currentKm != null ? nextKm - currentKm : null;
  const isWarning = kmLeft !== null && kmLeft <= (schedule.warning_km || 500);
  const isOverdue = kmLeft !== null && kmLeft <= 0;

  return (
    <div className={`bg-card rounded-2xl border p-3.5 card-shadow ${isOverdue ? "border-destructive/40 bg-destructive/5" : isWarning ? "border-amber-300 bg-amber-50/50 dark:bg-amber-500/5" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{schedule.name}</span>
            {isOverdue && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Vencida</span>}
            {isWarning && !isOverdue && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Em breve</span>}
          </div>
          {vehicle && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {vehicle.license_plate && (
                <span className="font-mono text-[10px] font-bold bg-secondary border border-border px-1.5 py-0.5 rounded-md tracking-widest">{vehicle.license_plate}</span>
              )}
              <span className="text-[11px] text-muted-foreground">{vehicle.brand} {vehicle.model}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-1.5">
            {schedule.interval_km && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Gauge className="w-3 h-3" /> Cada {schedule.interval_km.toLocaleString()} km
              </span>
            )}
            {schedule.interval_months && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="w-3 h-3" /> Cada {schedule.interval_months} meses
              </span>
            )}
          </div>
          {nextKm && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground">Próxima aos <span className="font-bold text-foreground">{nextKm.toLocaleString()} km</span></span>
              {kmLeft !== null && (
                <span className={`text-[11px] font-semibold ${isOverdue ? "text-destructive" : isWarning ? "text-amber-700" : "text-emerald-600"}`}>
                  {isOverdue ? `${Math.abs(kmLeft).toLocaleString()} km em atraso` : `${kmLeft.toLocaleString()} km restantes`}
                </span>
              )}
            </div>
          )}
          {hasLastKm && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Última: {schedule.last_done_km.toLocaleString()} km{schedule.last_done_date ? ` · ${schedule.last_done_date}` : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceScheduleManager({ vehicles }) {
  const [schedules, setSchedules] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [s, e] = await Promise.all([
      base44.entities.MaintenanceSchedule.list(),
      base44.entities.Expense.list("-date", 200),
    ]);
    setSchedules(s);
    setExpenses(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Current km per vehicle: max mileage from expenses
  const currentKmByVehicle = {};
  vehicles.forEach(v => {
    const vExp = expenses.filter(e => e.vehicle_id === v.id && e.mileage_at_expense);
    const maxKm = vExp.length > 0 ? Math.max(...vExp.map(e => e.mileage_at_expense)) : v.mileage || 0;
    currentKmByVehicle[v.id] = maxKm;
  });

  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.MaintenanceSchedule.update(editing.id, data);
      setEditing(null);
    } else {
      await base44.entities.MaintenanceSchedule.create(data);
      setShowForm(false);
    }
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.MaintenanceSchedule.delete(id);
    load();
  };

  if (loading) return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  // Sort: overdue first, then warning, then ok
  const sorted = [...schedules].sort((a, b) => {
    const getStatus = (s) => {
      const km = currentKmByVehicle[s.vehicle_id] || 0;
      const next = s.last_done_km != null && s.interval_km != null ? s.last_done_km + s.interval_km : null;
      const left = next != null ? next - km : null;
      if (left !== null && left <= 0) return 0;
      if (left !== null && left <= (s.warning_km || 500)) return 1;
      return 2;
    };
    return getStatus(a) - getStatus(b);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Manutenções por Km</h2>
        <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs gap-1.5" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      {(showForm && !editing) && (
        <ScheduleForm vehicles={vehicles} onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {sorted.length === 0 && !showForm && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm card-shadow">
          <Gauge className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Sem manutenções configuradas.<br />Adiciona uma para receber alertas de quilometragem.
        </div>
      )}

      {sorted.map(s => (
        editing?.id === s.id ? (
          <ScheduleForm key={s.id} vehicles={vehicles} initial={{ ...s, interval_km: s.interval_km || "", interval_months: s.interval_months || "", last_done_km: s.last_done_km || "", last_done_date: s.last_done_date || "" }} onSave={handleSave} onCancel={() => setEditing(null)} />
        ) : (
          <ScheduleCard
            key={s.id}
            schedule={s}
            vehicle={vehicleMap[s.vehicle_id]}
            currentKm={currentKmByVehicle[s.vehicle_id]}
            onEdit={() => { setEditing(s); setShowForm(false); }}
            onDelete={() => handleDelete(s.id)}
          />
        )
      ))}
    </div>
  );
}