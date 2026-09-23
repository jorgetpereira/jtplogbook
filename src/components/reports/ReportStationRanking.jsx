import { useMemo } from "react";
import { Star, TrendingDown, Fuel } from "lucide-react";
import DGEGPricesBanner from "./DGEGPricesBanner";

export default function ReportStationRanking({ expenses }) {
  const usedSubCategories = useMemo(() => {
    return [...new Set(expenses.filter(e => e.category === "Combustível").map(e => e.sub_category).filter(Boolean))];
  }, [expenses]);

  const stations = useMemo(() => {
    const map = {};
    expenses
      .filter(e => e.category === "Combustível" && e.location && e.price_per_unit)
      .forEach(e => {
        if (!map[e.location]) {
          map[e.location] = { name: e.location, prices: [], totalCost: 0, count: 0, liters: 0 };
        }
        map[e.location].prices.push(e.price_per_unit);
        map[e.location].totalCost += e.amount || 0;
        map[e.location].count += 1;
        map[e.location].liters += e.liters || 0;
      });

    return Object.values(map)
      .map(s => ({
        ...s,
        avgPrice: s.prices.reduce((a, b) => a + b, 0) / s.prices.length,
        minPrice: Math.min(...s.prices),
        maxPrice: Math.max(...s.prices),
      }))
      .filter(s => s.count >= 1)
      .sort((a, b) => a.avgPrice - b.avgPrice);
  }, [expenses]);

  if (stations.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">Sem dados de postos suficientes. Certifique-se de que os abastecimentos têm preço/litro e local preenchidos.</p>
      </div>
    );
  }

  const cheapest = stations[0];
  const mostUsed = [...stations].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-4">
      {/* DGEG reference prices */}
      <DGEGPricesBanner usedSubCategories={usedSubCategories} />

      {/* Highlights */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">Mais Barato</span>
          </div>
          <p className="font-bold text-sm truncate">{cheapest.name}</p>
          <p className="text-lg font-bold text-green-600">€{cheapest.avgPrice.toFixed(3)}<span className="text-xs font-normal text-muted-foreground">/L</span></p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Mais Usado</span>
          </div>
          <p className="font-bold text-sm truncate">{mostUsed.name}</p>
          <p className="text-lg font-bold text-blue-600">{mostUsed.count}<span className="text-xs font-normal text-muted-foreground"> visitas</span></p>
        </div>
      </div>

      {/* Full ranking */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Fuel className="w-4 h-4 text-primary" />
            Ranking de Postos (por preço médio)
          </h3>
        </div>
        <div className="divide-y divide-border">
          {stations.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i === 0 ? "bg-green-100 text-green-700" :
                i === 1 ? "bg-gray-100 text-gray-600" :
                i === 2 ? "bg-amber-100 text-amber-700" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.count} abastecimento{s.count !== 1 ? "s" : ""} · {s.liters.toFixed(0)}L total</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm text-primary">€{s.avgPrice.toFixed(3)}</p>
                <p className="text-[10px] text-muted-foreground">
                  min €{s.minPrice.toFixed(3)} · max €{s.maxPrice.toFixed(3)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}