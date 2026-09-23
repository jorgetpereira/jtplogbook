import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { enqueue } from "@/lib/offlineQueue";
import { saveCache, loadCache } from "@/lib/dataCache";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Plus, Zap, RefreshCw, Pencil, Trash2, ChevronDown, ChevronUp, Home, Upload, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChargingForm from "@/components/charging/ChargingForm";
import ChargingCSVImport from "@/components/charging/ChargingCSVImport";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

function formatDuration(mins) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

function ChargingCard({ charging, vehicle, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const startDate = charging.start_datetime ? new Date(charging.start_datetime) : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          charging.location_type === "Casa"
            ? "bg-sky-100 dark:bg-sky-900/30"
            : "bg-orange-100 dark:bg-orange-900/30"
        }`}>
          {charging.location_type === "Casa"
            ? <Home className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            : <Zap className="w-5 h-5 text-orange-500" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm">
              {charging.location_name || charging.location_type || "Carregamento"}
            </p>
            {charging.location_type && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                charging.location_type === "Casa"
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
              }`}>
                {charging.location_type === "Casa" ? "🏠 Casa" : "⚡ Fora"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {startDate ? format(startDate, "d MMM yyyy, HH:mm", { locale: pt }) : "—"}
            {vehicle ? ` · ${vehicle.brand} ${vehicle.model}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {charging.kwh_added != null && (
              <span className="text-xs font-semibold text-primary">⚡ {charging.kwh_added} kWh</span>
            )}
            {charging.soc_start_pct != null && charging.soc_end_pct != null && (
              <span className="text-xs text-muted-foreground">{charging.soc_start_pct}% → {charging.soc_end_pct}%</span>
            )}
            {charging.duration_minutes != null && (
              <span className="text-xs text-muted-foreground">🕐 {formatDuration(charging.duration_minutes)}</span>
            )}
            {charging.total_cost != null && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">€{charging.total_cost.toFixed(2)}</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {charging.start_datetime && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Início</p>
                <p className="font-semibold">{format(new Date(charging.start_datetime), "dd/MM/yyyy HH:mm")}</p>
              </div>
            )}
            {charging.end_datetime && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Fim</p>
                <p className="font-semibold">{format(new Date(charging.end_datetime), "dd/MM/yyyy HH:mm")}</p>
              </div>
            )}
            {charging.duration_minutes != null && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Duração</p>
                <p className="font-semibold">{formatDuration(charging.duration_minutes)}</p>
              </div>
            )}
            {charging.odometer != null && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Odómetro</p>
                <p className="font-semibold">{charging.odometer.toLocaleString("pt")} km</p>
              </div>
            )}
            {charging.kwh_added != null && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">kWh Adicionados</p>
                <p className="font-semibold">{charging.kwh_added} kWh</p>
              </div>
            )}
            {charging.range_km != null && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Autonomia</p>
                <p className="font-semibold">{charging.range_km} km</p>
              </div>
            )}
            {charging.price_per_kwh != null && (
              <div className="bg-muted/50 rounded-xl p-2.5">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Preço/kWh</p>
                <p className="font-semibold">€{charging.price_per_kwh}</p>
              </div>
            )}
            {charging.total_cost != null && (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-2.5 border border-green-200 dark:border-green-800">
                <p className="text-muted-foreground text-[10px] font-medium mb-0.5">Custo Total</p>
                <p className="font-bold text-green-700 dark:text-green-400">€{charging.total_cost.toFixed(2)}</p>
              </div>
            )}
          </div>
          {charging.notes && (
            <p className="text-xs text-muted-foreground italic">{charging.notes}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs" onClick={() => onEdit(charging)}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(charging.id)}>
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Charging() {
  const [chargings, setChargings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const evVehicles = vehicles.filter(v => ["Elétrico", "Híbrido", "Híbrido EREV"].includes(v.fuel_type));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const { isOnline, refresh: refreshOffline } = useOfflineSync();

  const load = async () => {
    setLoading(true);
    try {
      const [c, v] = await Promise.all([
        base44.entities.Charging.list("-start_datetime"),
        base44.entities.Vehicle.list(),
      ]);
      setChargings(c);
      setVehicles(v);
      saveCache('chargings', c);
      saveCache('vehicles', v);
      const ev = v.filter(x => ["Elétrico", "Híbrido", "Híbrido EREV"].includes(x.fuel_type));
      if (ev.length === 1) setSelectedVehicleId(ev[0].id);

      // Garantir que postos já usados existem na entidade Location
      const existingLocations = await base44.entities.Location.filter({ type: "Eletricidade" });
      const existingNames = new Set(existingLocations.map(l => l.name.toLowerCase()));
      const usedNames = [...new Set(
        c.filter(x => x.location_type === "Fora" && x.location_name?.trim())
         .map(x => x.location_name.trim())
      )];
      for (const name of usedNames) {
        if (!existingNames.has(name.toLowerCase())) {
          await base44.entities.Location.create({ name, type: "Eletricidade" });
        }
      }
    } catch {
      // Offline — restaurar dados em cache
      setChargings(loadCache('chargings') || []);
      setVehicles(loadCache('vehicles') || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    const tempId = `temp-${Date.now()}`;
    // Optimistic UI — mostrar imediatamente
    if (editing) {
      setChargings(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c));
    } else {
      setChargings(prev => [{ ...data, id: tempId }, ...prev]);
    }
    setShowForm(false);
    setEditing(null);

    // Offline — colocar na fila para sincronizar depois
    if (!isOnline) {
      enqueue({
        entity: 'Charging',
        action: editing ? 'update' : 'create',
        recordId: editing?.id,
        payload: data,
      });
      if (!editing) {
        const expenseDate = data.start_datetime
          ? data.start_datetime.split("T")[0]
          : new Date().toISOString().split("T")[0];
        enqueue({
          entity: 'Expense',
          action: 'create',
          payload: {
            vehicle_id: data.vehicle_id,
            category: "Combustível",
            sub_category: "Eletricidade",
            amount: data.total_cost || 0,
            date: expenseDate,
            mileage_at_expense: data.odometer || undefined,
            liters: data.kwh_added || undefined,
            price_per_unit: data.price_per_kwh || undefined,
            location: data.location_name || data.location_type || undefined,
            description: data.notes || undefined,
            full_tank: data.soc_end_pct === 100,
            car_avg_consumption: data.car_avg_consumption || undefined,
          },
        });
      }
      if (data.odometer && data.vehicle_id) {
        const vehicle = vehicles.find(v => v.id === data.vehicle_id);
        if (vehicle && (!vehicle.mileage || data.odometer > vehicle.mileage)) {
          enqueue({
            entity: 'Vehicle',
            action: 'update',
            recordId: vehicle.id,
            payload: { mileage: data.odometer },
          });
        }
      }
      refreshOffline();
      return;
    }

    // Online — guardar diretamente
    if (editing) {
      await base44.entities.Charging.update(editing.id, data);
      // Atualizar despesa associada (criada quando o carregamento foi registado)
      const oldExpenseDate = (editing.start_datetime || "").split("T")[0];
      const candidates = await base44.entities.Expense.filter({
        vehicle_id: editing.vehicle_id,
        date: oldExpenseDate,
        sub_category: "Eletricidade",
      });
      const expense = candidates.find(e => Math.abs((e.amount || 0) - (editing.total_cost || 0)) < 0.01) || candidates[0];
      if (expense) {
        const newExpenseDate = (data.start_datetime || "").split("T")[0] || oldExpenseDate;
        await base44.entities.Expense.update(expense.id, {
          amount: data.total_cost || 0,
          date: newExpenseDate,
          mileage_at_expense: data.odometer || undefined,
          liters: data.kwh_added || undefined,
          price_per_unit: data.price_per_kwh || undefined,
          location: data.location_name || data.location_type || undefined,
          description: data.notes || undefined,
          full_tank: data.soc_end_pct === 100,
          car_avg_consumption: data.car_avg_consumption || undefined,
        });
      }
    } else {
      await base44.entities.Charging.create(data);
      const expenseDate = data.start_datetime
        ? data.start_datetime.split("T")[0]
        : new Date().toISOString().split("T")[0];
      await base44.entities.Expense.create({
        vehicle_id: data.vehicle_id,
        category: "Combustível",
        sub_category: "Eletricidade",
        amount: data.total_cost || 0,
        date: expenseDate,
        mileage_at_expense: data.odometer || undefined,
        liters: data.kwh_added || undefined,
        price_per_unit: data.price_per_kwh || undefined,
        location: data.location_name || data.location_type || undefined,
        description: data.notes || undefined,
        full_tank: data.soc_end_pct === 100,
        car_avg_consumption: data.car_avg_consumption || undefined,
      });
    }
    if (data.odometer && data.vehicle_id) {
      const vehicle = vehicles.find(v => v.id === data.vehicle_id);
      if (vehicle && (!vehicle.mileage || data.odometer > vehicle.mileage)) {
        await base44.entities.Vehicle.update(vehicle.id, { mileage: data.odometer });
      }
    }
    load();
  };

  const handleEdit = (c) => { setEditing(c); setShowForm(true); };

  const handleDelete = async (id) => {
    setChargings(prev => prev.filter(c => c.id !== id));
    if (!isOnline) {
      enqueue({ entity: 'Charging', action: 'delete', recordId: id, payload: {} });
      refreshOffline();
      return;
    }
    await base44.entities.Charging.delete(id);
    load();
  };

  const handleCSVImport = async (rows) => {
    for (const row of rows) {
      await base44.entities.Charging.create(row);
      const expenseDate = row.start_datetime
        ? row.start_datetime.split("T")[0]
        : new Date().toISOString().split("T")[0];
      await base44.entities.Expense.create({
        vehicle_id: row.vehicle_id,
        category: "Combustível",
        sub_category: "Eletricidade",
        amount: row.total_cost || 0,
        date: expenseDate,
        mileage_at_expense: row.odometer || undefined,
        liters: row.kwh_added || undefined,
        price_per_unit: row.price_per_kwh || undefined,
        location: row.location_name || row.location_type || undefined,
        description: row.notes || undefined,
        full_tank: row.soc_end_pct === 100,
        car_avg_consumption: row.car_avg_consumption || undefined,
      });
      // Atualizar quilometragem do veículo automaticamente
      if (row.odometer && row.vehicle_id) {
        const vehicle = vehicles.find(v => v.id === row.vehicle_id);
        if (vehicle && (!vehicle.mileage || row.odometer > vehicle.mileage)) {
          await base44.entities.Vehicle.update(vehicle.id, { mileage: row.odometer });
        }
      }
    }
    setShowCSV(false);
    load();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(`Tem a certeza que quer eliminar todos os ${chargings.length} carregamentos? Esta ação não pode ser revertida.`)) return;
    for (const c of chargings) {
      await base44.entities.Charging.delete(c.id);
    }
    load();
  };

  // Último registo do veículo selecionado (para pré-preencher o formulário)
  const lastCharging = (() => {
    const vehicleId = editing ? null : (selectedVehicleId !== "all" ? selectedVehicleId : evVehicles[0]?.id);
    if (!vehicleId) return null;
    const forVehicle = chargings.filter(c => c.vehicle_id === vehicleId);
    return forVehicle.length > 0 ? forVehicle[0] : null; // já ordenado por -start_datetime
  })();

  const filtered = selectedVehicleId === "all"
    ? chargings
    : chargings.filter(c => c.vehicle_id === selectedVehicleId);

  const totalKwh = filtered.reduce((s, c) => s + (c.kwh_added || 0), 0);
  const totalCost = filtered.reduce((s, c) => s + (c.total_cost || 0), 0);
  const avgPrice = totalKwh > 0 ? totalCost / totalKwh : null;

  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div
        className="bg-gradient-to-br from-amber-500 to-orange-500 text-white px-4 pb-4 sticky top-0 z-20 shadow-lg shadow-amber-500/20"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Carregamentos</h1>
            <p className="text-xs text-white/60 mt-0.5">Histórico EV / Híbrido</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-white text-amber-600 font-bold text-sm shadow-lg shadow-amber-900/20 hover:bg-white/90 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Carregamento
          </button>
        </div>

        {/* Vehicle tabs */}
        {evVehicles.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setSelectedVehicleId("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedVehicleId === "all" ? "bg-white text-emerald-600 shadow-sm" : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
              }`}
            >
              Todos
            </button>
            {evVehicles.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedVehicleId === v.id ? "bg-white text-emerald-600 shadow-sm" : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
                }`}
              >
                {v.brand} {v.model}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pt-4 pb-24 space-y-4">
        {/* Summary cards */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Sessões</p>
              <p className="text-xl font-bold text-primary">{filtered.length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">kWh Total</p>
              <p className="text-xl font-bold text-primary">{totalKwh.toFixed(1)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Custo Total</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">€{totalCost.toFixed(2)}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">A carregar...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Zap className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Nenhum carregamento registado</p>
              <p className="text-sm text-muted-foreground mt-1">Toque no + para adicionar o primeiro</p>
            </div>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
            >
              Novo Carregamento
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(c => (
              <ChargingCard
                key={c.id}
                charging={c}
                vehicle={vehicleMap[c.vehicle_id]}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={showCSV} onOpenChange={setShowCSV}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar CSV</DialogTitle>
          </DialogHeader>
          <ChargingCSVImport
            vehicles={evVehicles}
            onImport={handleCSVImport}
            onClose={() => setShowCSV(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Carregamento" : "Novo Carregamento"}</DialogTitle>
          </DialogHeader>
          {evVehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Não tem veículos Elétricos ou Híbridos registados.</p>
          ) : (
            <ChargingForm
              charging={editing}
              vehicles={evVehicles}
              lastCharging={lastCharging}
              history={chargings}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}