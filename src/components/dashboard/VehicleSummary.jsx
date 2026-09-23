import { Fuel, Wrench, Clock, TrendingUp, Calendar, Zap, ChevronRight } from "lucide-react";
import { differenceInDays, format, addDays } from "date-fns";
import { pt } from "date-fns/locale";

export default function VehicleSummary({ vehicle, expenses }) {
  if (!vehicle) return null;

  const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id);
  const fuelExpenses = vehicleExpenses
    .filter(e => e.category === "Combustível")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const maintenanceExpenses = vehicleExpenses.filter(e => e.category === "Manutenção");

  const isElectric = vehicle.fuel_type === "Elétrico";
  const isHybrid = vehicle.fuel_type === "Híbrido";

  const electricExpenses = fuelExpenses.filter(e => e.sub_category === "Eletricidade");
  const fuelOnlyExpenses = fuelExpenses.filter(e => e.sub_category !== "Eletricidade");

  const totalElectric = electricExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalFuelOnly = fuelOnlyExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalFuel = fuelExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalMaint = maintenanceExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalAll = totalFuel + totalMaint;

  // Use the highest mileage from expense records, falling back to vehicle.mileage
  const maxMileageFromExpenses = vehicleExpenses
    .map(e => e.mileage_at_expense)
    .filter(Boolean)
    .reduce((max, km) => Math.max(max, km), 0);
  const displayMileage = maxMileageFromExpenses || vehicle.mileage;

  let fuelEstimate = null;
  if (fuelExpenses.length >= 2) {
    const intervals = [];
    for (let i = 0; i < fuelExpenses.length - 1; i++) {
      const days = differenceInDays(
        new Date(fuelExpenses[i].date + "T12:00:00"),
        new Date(fuelExpenses[i + 1].date + "T12:00:00")
      );
      if (days > 0) intervals.push(days);
    }
    if (intervals.length > 0) {
      const avgDays = Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length);
      const lastDate = new Date(fuelExpenses[0].date + "T12:00:00");
      const nextDate = addDays(lastDate, avgDays);
      const daysUntil = differenceInDays(nextDate, new Date());
      fuelEstimate = { nextDate, daysUntil, avgDays };
    }
  }

  const statCards = [];
  if (!isElectric) statCards.push({ icon: Fuel, color: "text-blue-500", bg: "bg-blue-50 border-blue-100", value: `€${(isHybrid ? totalFuelOnly : totalFuel).toFixed(0)}`, label: "Combustível" });
  if (isElectric || isHybrid) statCards.push({ icon: Zap, color: "text-amber-500", bg: "bg-amber-50 border-amber-100", value: `€${totalElectric.toFixed(0)}`, label: "Eletricidade" });
  statCards.push({ icon: Wrench, color: "text-orange-500", bg: "bg-orange-50 border-orange-100", value: `€${totalMaint.toFixed(0)}`, label: "Manutenção" });
  statCards.push({ icon: TrendingUp, color: "text-primary", bg: "bg-primary/5 border-primary/10", value: `€${totalAll.toFixed(0)}`, label: "Total Geral" });

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow overflow-hidden">
      {/* Header strip */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg text-white leading-tight">{vehicle.brand} {vehicle.model}</h2>
            <div className="flex items-center gap-2 mt-1">
              {vehicle.license_plate && (
                <span className="font-mono text-xs bg-white/20 text-white px-2 py-0.5 rounded-lg font-semibold tracking-widest">
                  {vehicle.license_plate}
                </span>
              )}
              <span className="text-xs text-white/70">{vehicle.fuel_type}</span>
            </div>
            {vehicle.last_maintenance_date && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-white/70">
                <Calendar className="w-3 h-3" />
                Revisão: {format(new Date(vehicle.last_maintenance_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
                {vehicle.last_maintenance_km && <span>· {vehicle.last_maintenance_km.toLocaleString()} km</span>}
              </div>
            )}
          </div>
          {displayMileage > 0 && (
            <div className="text-right">
              <p className="font-bold text-2xl text-white leading-none">{displayMileage.toLocaleString()}</p>
              <p className="text-xs text-white/60 mt-0.5">km totais</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className={`grid gap-3 p-4 ${statCards.length === 4 ? "grid-cols-4" : statCards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {statCards.map((s, i) => (
          <div key={i} className={`rounded-xl border p-3 text-center ${s.bg}`}>
            <s.icon className={`w-4 h-4 mx-auto mb-1.5 ${s.color}`} />
            <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fuel estimate banner */}
      {fuelEstimate ? (
        <div className={`mx-4 mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
          fuelEstimate.daysUntil < 0
            ? "bg-red-50 text-red-700 border border-red-100"
            : fuelEstimate.daysUntil <= 3
            ? "bg-amber-50 text-amber-700 border border-amber-100"
            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
        }`}>
          <Clock className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">
              {fuelEstimate.daysUntil < 0
                ? `Abastecimento em atraso (${Math.abs(fuelEstimate.daysUntil)} dias)`
                : fuelEstimate.daysUntil === 0
                ? "Abastecer hoje"
                : `Próximo abastecimento em ${fuelEstimate.daysUntil} dia${fuelEstimate.daysUntil !== 1 ? "s" : ""}`}
            </span>
            <span className="text-xs ml-1.5 opacity-60">
              {format(fuelEstimate.nextDate, "d MMM", { locale: pt })} · média {fuelEstimate.avgDays}d
            </span>
          </div>
        </div>
      ) : fuelExpenses.length === 1 ? (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl px-4 py-3 bg-muted text-muted-foreground text-sm border border-border">
          <Clock className="w-4 h-4 shrink-0" />
          <p>Adicione mais abastecimentos para calcular a estimativa.</p>
        </div>
      ) : null}
    </div>
  );
}