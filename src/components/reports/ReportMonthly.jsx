import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Fuel, Wrench, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

function getVehicleName(vehicles, id) {
  const v = vehicles.find(v => v.id === id);
  return v ? `${v.brand} ${v.model}` : "—";
}

function getVehiclePlate(vehicles, id) {
  const v = vehicles.find(v => v.id === id);
  return v?.license_plate || null;
}

export default function ReportMonthly({ expenses, vehicles }) {
  // Agrupa por mês → por veículo
  const monthlyData = useMemo(() => {
    const map = {}; // { "2025-06": { vehicleId: { fuel, electric, maintenance, other, total, kwh, liters } } }

    expenses.forEach(e => {
      if (!e.date) return;
      const month = e.date.slice(0, 7); // "YYYY-MM"
      if (!map[month]) map[month] = {};
      const vid = e.vehicle_id || "_unknown";
      if (!map[month][vid]) {
        map[month][vid] = { fuel: 0, electric: 0, maintenance: 0, other: 0, total: 0, kwh: 0, liters: 0 };
      }
      const row = map[month][vid];
      const amt = e.amount || 0;
      row.total += amt;

      if (e.category === "Combustível") {
        if (e.sub_category === "Eletricidade") {
          row.electric += amt;
          row.kwh += e.liters || 0;
        } else {
          row.fuel += amt;
          row.liters += e.liters || 0;
        }
      } else if (e.category === "Manutenção") {
        row.maintenance += amt;
      } else {
        row.other += amt;
      }
    });

    // Ordena meses descendente
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, vehicleMap]) => ({
        month,
        label: format(parseISO(month + "-01"), "MMMM yyyy", { locale: pt }),
        vehicles: Object.entries(vehicleMap)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([vid, data]) => ({ vid, ...data })),
        totalMonth: Object.values(vehicleMap).reduce((s, r) => s + r.total, 0),
      }));
  }, [expenses]);

  if (monthlyData.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">
        Sem despesas registadas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {monthlyData.map(({ month, label, vehicles: vRows, totalMonth }, mi) => {
        const prevTotal = monthlyData[mi + 1]?.totalMonth;
        const delta = prevTotal ? totalMonth - prevTotal : null;
        const deltaSign = delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "same";

        return (
          <div key={month} className="bg-card rounded-2xl border border-border overflow-hidden card-shadow">
            {/* Month header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/60 border-b border-border">
              <span className="font-bold text-sm capitalize text-foreground">{label}</span>
              <div className="flex items-center gap-2">
                {deltaSign === "up" && (
                  <span className="flex items-center gap-0.5 text-[11px] text-red-500 font-semibold">
                    <TrendingUp className="w-3 h-3" /> +{delta.toFixed(2)}€
                  </span>
                )}
                {deltaSign === "down" && (
                  <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-semibold">
                    <TrendingDown className="w-3 h-3" /> {delta.toFixed(2)}€
                  </span>
                )}
                {deltaSign === "same" && <Minus className="w-3 h-3 text-muted-foreground" />}
                <span className="font-extrabold text-base text-foreground tabular-nums">
                  {totalMonth.toFixed(2)} <span className="text-sm font-semibold text-muted-foreground">€</span>
                </span>
              </div>
            </div>

            {/* Vehicle rows */}
            <div className="divide-y divide-border/60">
              {vRows.map(row => {
                const vName = getVehicleName(vehicles, row.vid);
                const vPlate = getVehiclePlate(vehicles, row.vid);

                return (
                  <div key={row.vid} className="px-4 py-3">
                    {/* Vehicle identity */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {vPlate && (
                          <span className="font-mono text-[11px] font-bold bg-secondary border border-border px-2 py-0.5 rounded-lg tracking-widest">
                            {vPlate}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-foreground">{vName}</span>
                      </div>
                      <span className="font-bold text-sm tabular-nums text-foreground">
                        {row.total.toFixed(2)} €
                      </span>
                    </div>

                    {/* Breakdown pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {row.fuel > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                          <Fuel className="w-3 h-3" />
                          {row.fuel.toFixed(2)} €
                          {row.liters > 0 && <span className="text-orange-500/70">· {row.liters.toFixed(1)} L</span>}
                        </span>
                      )}
                      {row.electric > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                          <Zap className="w-3 h-3" />
                          {row.electric.toFixed(2)} €
                          {row.kwh > 0 && <span className="text-blue-500/70">· {row.kwh.toFixed(1)} kWh</span>}
                        </span>
                      )}
                      {row.maintenance > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full">
                          <Wrench className="w-3 h-3" />
                          {row.maintenance.toFixed(2)} €
                        </span>
                      )}
                      {row.other > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                          {row.other.toFixed(2)} € outros
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}