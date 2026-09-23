import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Wrench, Car, CheckCircle2, Plus, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import VehicleIssueCard from "@/components/vehicles/VehicleIssueCard";
import VehicleIssueForm from "@/components/vehicles/VehicleIssueForm";
import { syncVehicleMileage } from "@/lib/vehicleMileage";

export default function Revisao() {
  const [issues, setIssues] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");

  const load = async () => {
    const [openIssues, v] = await Promise.all([
      base44.entities.VehicleIssue.filter({ status: "Aberto" }, "-detected_date"),
      base44.entities.Vehicle.list()
    ]);
    setIssues(openIssues);
    setVehicles(v);
    if (v.length && !selectedVehicleId) setSelectedVehicleId(v[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const filteredIssues = filterType === "all"
    ? issues
    : issues.filter(i => (i.maintenance_type || "Corretiva") === filterType);

  const grouped = {};
  filteredIssues.forEach(i => {
    if (!grouped[i.vehicle_id]) grouped[i.vehicle_id] = [];
    grouped[i.vehicle_id].push(i);
  });

  const counts = {
    all: issues.length,
    Corretiva: issues.filter(i => (i.maintenance_type || "Corretiva") === "Corretiva").length,
    Preventiva: issues.filter(i => i.maintenance_type === "Preventiva").length,
  };

  const handleAdd = async (data) => {
    await base44.entities.VehicleIssue.create(data);
    await syncVehicleMileage(data.vehicle_id, data.odometer);
    await load();
    setShowForm(false);
  };

  const handleEdit = async (issue, data) => {
    await base44.entities.VehicleIssue.update(issue.id, data);
    await syncVehicleMileage(data.vehicle_id, data.odometer);
    await load();
  };

  const handleResolve = async (issue, resolveData) => {
    await base44.entities.VehicleIssue.update(issue.id, { ...resolveData, status: "Resolvido" });
    setIssues(prev => prev.filter(i => i.id !== issue.id));
  };

  const handleDelete = async (id) => {
    await base44.entities.VehicleIssue.delete(id);
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  const selectedVehicle = vehicleMap[selectedVehicleId];

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
      <div className="bg-gradient-to-br from-rose-600 to-red-700 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-rose-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Wrench className="w-5 h-5 opacity-80" />
          Revisão
        </h1>
        <p className="text-white/60 text-xs mt-0.5">Avarias e notas em aberto em todos os veículos</p>
      </div>

      {/* Add button / form */}
      {!showForm ? (
        <>
          <div className="flex gap-1 bg-muted rounded-2xl p-1">
            {[
              { key: "all", label: "Todas", count: counts.all, Icon: Wrench },
              { key: "Corretiva", label: "Corretiva", count: counts.Corretiva, Icon: AlertTriangle },
              { key: "Preventiva", label: "Preventiva", count: counts.Preventiva, Icon: ShieldCheck },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all",
                  filterType === t.key ? "bg-card shadow text-foreground" : "text-muted-foreground")}
              >
                <t.Icon className="w-3.5 h-3.5" /> {t.label} ({t.count})
              </button>
            ))}
          </div>
          <button
            onClick={() => vehicles.length ? setShowForm(true) : null}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={!vehicles.length}
          >
            <Plus className="w-4 h-4" /> Nova Avaria / Nota
          </button>
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 card-shadow space-y-3">
          {vehicles.length > 1 && (
            <div>
              <label className="text-xs font-medium">Veículo</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>
                ))}
              </select>
            </div>
          )}
          {selectedVehicle && <VehicleIssueForm vehicle={selectedVehicle} onSave={handleAdd} />}
          <button onClick={() => setShowForm(false)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
            Cancelar
          </button>
        </div>
      )}

      {/* Issues grouped by vehicle */}
      {filteredIssues.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-14 text-center card-shadow">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-foreground font-semibold text-sm">Sem avarias em aberto</p>
          <p className="text-muted-foreground text-xs mt-1">Tudo em dia! As novas avarias aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([vid, vIssues]) => {
            const vehicle = vehicleMap[vid];
            return (
              <div key={vid} className="space-y-2">
                <Link to={`/vehicles/${vid}`} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary px-1">
                  <Car className="w-3.5 h-3.5" />
                  {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo removido"}
                </Link>
                <div className="space-y-2">
                  {vIssues.map(issue => (
                    <VehicleIssueCard key={issue.id} issue={issue} onResolve={handleResolve} onDelete={handleDelete} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}