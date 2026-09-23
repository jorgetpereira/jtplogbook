import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Zap, Fuel, RefreshCw, ChevronDown, ChevronUp, Download } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// Maps our sub_category values to DGEG slugs
const SUB_TO_SLUG = {
  "Gasóleo Simples":       "diesel",
  "Gasóleo":               "diesel",
  "Gasóleo Aditivado":     "diesel_plus",
  "Gasóleo Especial":      "diesel_plus",
  "Biodiesel":             "diesel",
  "Gasolina 95":           "gasoline_95",
  "Gasolina":              "gasoline_95",
  "Gasolina Aditivada 98": "gasoline_98_plus",
  "Gasolina Especial 98":  "gasoline_98_plus",
  "Gasolina 98":           "gasoline_98_plus",
  "GPL":                   "gpl_auto",
};



export default function DGEGPricesBanner({ usedSubCategories = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showEV, setShowEV] = useState(false);
  const [showBrand, setShowBrand] = useState(false);

  const downloadBrandCSV = () => {
    if (!data?.fuel_by_brand) return;
    const rows = [["Marca", "Tipo", "Preço (€/L)", "Notas"]];
    data.fuel_by_brand.forEach(b => rows.push([b.brand, b.type, b.price.toFixed(3), b.notes]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `precos-combustivel-marca-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    base44.functions.invoke("getDGEGPrices", {})
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        <span className="text-sm text-muted-foreground">A carregar preços DGEG...</span>
      </div>
    );
  }

  if (!data) return null;

  // Determine which fuels to show based on what the user actually uses
  const relevantSlugs = [...new Set(usedSubCategories.map(s => SUB_TO_SLUG[s]).filter(Boolean))];

  const primaryFuels = data.fuels.filter(f => relevantSlugs.includes(f.slug));

  const allFuels = primaryFuels;

  const updatedDate = data.fuels[0]?.date
    ? format(new Date(data.fuels[0].date), "d 'de' MMMM yyyy", { locale: pt })
    : "hoje";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Preços de Referência DGEG</p>
            <p className="text-[10px] text-muted-foreground">Atualizado: {updatedDate} · Preço médio nacional c/ IVA</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary fuels — always visible */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(expanded ? allFuels : primaryFuels.slice(0, 4)).map(f => (
            <div key={f.slug} className="bg-muted/40 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Fuel className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] text-muted-foreground font-medium truncate">{f.name}</span>
              </div>
              <p className="text-lg font-bold text-foreground">€{f.avg.toFixed(3)}<span className="text-[10px] font-normal text-muted-foreground">/L</span></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {f.stations.toLocaleString("pt-PT")} postos · min €{f.min.toFixed(3)}
              </p>
            </div>
          ))}
        </div>

        {/* Fuel by brand toggle */}
        <button
          onClick={() => setShowBrand(v => !v)}
          className="mt-3 flex items-center gap-2 text-xs text-primary font-medium hover:underline"
        >
          <Fuel className="w-3 h-3" />
          {showBrand ? "Ocultar" : "Ver"} preços por marca de combustível
          {showBrand ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showBrand && data?.fuel_by_brand && (
          <div className="mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.fuel_by_brand.filter(b => usedSubCategories.length === 0 || usedSubCategories.includes(b.type)).map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold">{b.brand}</p>
                    <p className="text-[10px] text-muted-foreground">{b.type} · {b.notes}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400 shrink-0 ml-2">
                    €{b.price.toFixed(3)}<span className="text-[10px] font-normal">/L</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[10px] text-muted-foreground">* Preços indicativos. Consulte o posto mais próximo.</p>
              <button onClick={downloadBrandCSV} className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline">
                <Download className="w-3 h-3" />
                .csv
              </button>
            </div>
          </div>
        )}

        {/* EV tariffs toggle */}
        <button
          onClick={() => setShowEV(v => !v)}
          className="mt-3 flex items-center gap-2 text-xs text-primary font-medium hover:underline"
        >
          <Zap className="w-3 h-3" />
          {showEV ? "Ocultar" : "Ver"} preços carregamento elétrico
          {showEV ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showEV && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.ev_tariffs.map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-semibold">{t.provider}</p>
                  <p className="text-[10px] text-muted-foreground">{t.type} · {t.notes}</p>
                </div>
                <p className="text-sm font-bold text-green-700 dark:text-green-400 shrink-0 ml-2">
                   {t.price_kwh != null ? <>€{t.price_kwh.toFixed(3)}<span className="text-[10px] font-normal">/kWh</span></> : <span className="text-[10px] font-normal text-muted-foreground">variável</span>}
                 </p>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground col-span-full px-1">* Preços indicativos. Para carregamento doméstico, consulte a sua tarifa de eletricidade.</p>
          </div>
        )}
      </div>
    </div>
  );
}