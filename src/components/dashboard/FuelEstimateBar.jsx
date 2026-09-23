import { Droplets, Zap, Clock } from "lucide-react";

const MIN_AUTONOMY_DAYS = 5; // mínimo de dias úteis de autonomia após abastecimento

// Conta apenas dias úteis (seg-sex) entre duas datas
function countWeekdays(from, to) {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(12, 0, 0, 0);
  const end = new Date(to);
  end.setHours(12, 0, 0, 0);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Returns { days, estimatedKm } or null
function estimateDays(vehicle, expenses, fuelKey) {
  const isElec = fuelKey === "elec";

  const fuelExpenses = expenses
    .filter(e => {
      if (e.vehicle_id !== vehicle.id || e.category !== "Combustível") return false;
      return isElec
        ? e.sub_category === "Eletricidade"
        : e.sub_category !== "Eletricidade";
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (fuelExpenses.length === 0) return null;

  const last = fuelExpenses[0];
  const lastDate = new Date(last.date + "T12:00:00");
  const today = new Date();

  // Dias úteis desde o último abastecimento
  const weekdaysSinceLast = countWeekdays(lastDate, today);

  // Média de dias úteis entre abastecimentos
  let avgInterval = MIN_AUTONOMY_DAYS;
  if (fuelExpenses.length >= 2) {
    const intervals = [];
    for (let i = 0; i < fuelExpenses.length - 1; i++) {
      const d1 = new Date(fuelExpenses[i].date + "T12:00:00");
      const d2 = new Date(fuelExpenses[i + 1].date + "T12:00:00");
      const diff = countWeekdays(d2, d1);
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length > 0) {
      avgInterval = Math.max(MIN_AUTONOMY_DAYS, intervals.reduce((a, b) => a + b, 0) / intervals.length);
    }
  }

  const days = Math.max(0, Math.round(avgInterval - weekdaysSinceLast));
  return { days, estimatedKm: null };
}

export default function FuelEstimateBar({ vehicles, expenses, filterVehicle }) {
  const targetVehicles = filterVehicle === "all"
    ? vehicles
    : vehicles.filter(v => v.id === filterVehicle);

  const rows = [];

  targetVehicles.forEach(vehicle => {
    const isHybrid = vehicle.fuel_type === "Híbrido";
    const isElectric = vehicle.fuel_type === "Elétrico";
    const isEREV = vehicle.fuel_type === "Híbrido EREV";
    const vehicleName = `${vehicle.brand} ${vehicle.model}`;

    if (isElectric || isEREV) {
      const result = estimateDays(vehicle, expenses, "elec");
      if (result !== null) rows.push({ key: `${vehicle.id}_elec`, vehicleName, icon: Zap, fuelLabel: "Elétrico", labelColor: "text-chart-2", ...result });
    } else if (isHybrid) {
      const resFuel = estimateDays(vehicle, expenses, "fuel");
      const resElec = estimateDays(vehicle, expenses, "elec");
      // For hybrids: use the minimum days (whichever runs out first) for both rows
      const available = [resFuel, resElec].filter(Boolean);
      if (available.length > 0) {
        const minDays = Math.max(...available.map(r => r.days));
        if (resFuel !== null) rows.push({ key: `${vehicle.id}_fuel`, vehicleName, icon: Droplets, fuelLabel: "Combustível", labelColor: "text-chart-4", days: minDays, estimatedKm: null });
        if (resElec !== null) rows.push({ key: `${vehicle.id}_elec`, vehicleName, icon: Zap, fuelLabel: "Elétrico", labelColor: "text-chart-2", days: minDays, estimatedKm: null });
      }
    } else {
      const result = estimateDays(vehicle, expenses, "fuel");
      if (result !== null) rows.push({ key: `${vehicle.id}_fuel`, vehicleName, icon: Droplets, fuelLabel: vehicle.fuel_type, labelColor: "text-chart-1", ...result });
    }
  });

  if (rows.length === 0) return null;

  return (
    <div className="bg-teal-500/10 border border-teal-200 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2.5 -mx-4 -mt-3 px-4 py-2 bg-teal-500/20 rounded-t-2xl">
        <Clock className="w-3.5 h-3.5 text-teal-800" />
        <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">Estimativa de abastecimento</span>
      </div>
      <div className="space-y-1.5">
        {rows.map(({ key, vehicleName, icon: Icon, fuelLabel, labelColor, days, estimatedKm }) => {
          const isDone = days === 0;
          const isWarning = days >= 1 && days <= 9;
          const iconColor = isDone ? "text-red-500" : isWarning ? "text-yellow-500" : "text-green-500";
          const daysColor = isDone ? "text-red-500" : isWarning ? "text-yellow-600" : "text-green-600";
          return (
            <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto auto auto" }}>
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <Icon className={`w-3 h-3 shrink-0 ${iconColor}`} />
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {vehicleName}
                  {(filterVehicle === "all" || rows.filter(r => r.key.startsWith(key.split("_")[0])).length > 1) && (
                    <span className={`text-[10px] ml-1 font-semibold ${labelColor}`}>· {fuelLabel}</span>
                  )}
                </span>
              </div>
              <span className={`text-[10px] font-bold tabular-nums text-right ${daysColor}`}>
                {isDone ? "0 dias" : `~${days} dia${days === 1 ? "" : "s"}`}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {estimatedKm ? "-" : ""}
              </span>
              <span className="text-[10px] font-bold text-foreground tabular-nums text-right" style={{ minWidth: "4.5rem" }}>
                {estimatedKm ? `~${estimatedKm.toLocaleString()} km` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}