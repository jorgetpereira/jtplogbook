import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Wrench, Fuel, Zap, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS = {
  "Revisão": "bg-blue-100 text-blue-700 border-blue-200",
  "Pneus": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Reparação de Peça": "bg-red-100 text-red-700 border-red-200",
  "Seguro": "bg-purple-100 text-purple-700 border-purple-200",
  "Inspeção": "bg-green-100 text-green-700 border-green-200",
  "IUC": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Lavagem": "bg-cyan-100 text-cyan-700 border-cyan-200",
};

function TimelineIcon({ expense }) {
  if (expense.category === "Combustível") {
    return expense.sub_category === "Eletricidade"
      ? <Zap className="w-4 h-4 text-yellow-500" />
      : <Fuel className="w-4 h-4 text-blue-500" />;
  }
  return <Wrench className="w-4 h-4 text-gray-500" />;
}

export default function MaintenanceTimeline({ expenses, vehicle }) {
  const sorted = [...expenses]
    .filter(e => e.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Sem registos de despesas para este veículo.
      </div>
    );
  }

  // Group by year
  const byYear = {};
  sorted.forEach(e => {
    const year = e.date.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(e);
  });

  const totalCost = sorted.reduce((s, e) => s + (e.amount || 0), 0);
  const maintCount = sorted.filter(e => e.category === "Manutenção").length;
  const fuelCount = sorted.filter(e => e.category === "Combustível").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="text-base font-bold text-foreground">{sorted.length}</p>
          <p className="text-[10px] text-muted-foreground">Registos</p>
        </div>
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="text-base font-bold text-blue-600">{fuelCount}</p>
          <p className="text-[10px] text-muted-foreground">Combustível</p>
        </div>
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="text-base font-bold text-primary">€{totalCost.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Timeline by year */}
      {Object.keys(byYear).sort((a, b) => b - a).map(year => (
        <div key={year}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">{year}</span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground font-medium">
              €{byYear[year].reduce((s, e) => s + (e.amount || 0), 0).toFixed(0)}
            </span>
          </div>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-3">
              {byYear[year].map((expense, i) => (
                <div key={expense.id} className="relative">
                  {/* Dot */}
                  <div className={cn(
                    "absolute -left-6 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-card",
                    expense.category === "Combustível" ? "border-blue-400" : "border-primary"
                  )}>
                    <TimelineIcon expense={expense} />
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium border",
                            CATEGORY_COLORS[expense.sub_category] || "bg-muted text-muted-foreground border-border"
                          )}>
                            {expense.sub_category}
                          </span>
                          {expense.location && (
                            <span className="text-xs text-muted-foreground">📍 {expense.location}</span>
                          )}
                        </div>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground mt-1 italic truncate">{expense.description}</p>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {expense.mileage_at_expense && <span>🛣️ {expense.mileage_at_expense.toLocaleString()} km</span>}
                          {expense.liters && <span>⛽ {expense.liters}L</span>}
                          {expense.price_per_unit && <span>€{Number(expense.price_per_unit).toFixed(3)}/L</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">€{expense.amount?.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(expense.date + "T12:00:00"), "d MMM", { locale: pt })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}