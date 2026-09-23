import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { format as formatDate } from "date-fns";
import { pt } from "date-fns/locale";
import ChartWrapper from "../reports/ChartWrapper";

// Cores consistentes por combustível
const FUEL_COLORS = {
  "Gasóleo": "#16a34a",
  "Gasóleo Esp.": "#0d9488",
  "Gasolina 95": "#f97316",
  "Gasolina 95 Esp.": "#d97706",
  "Gasolina 98": "#dc2626",
  "Gasolina 98 Esp.": "#b91c1c",
  "GPL": "#7c3aed",
  "Elétrico": "#3b82f6",
};

function formatMonth(m) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return formatDate(d, "MMM yy", { locale: pt });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{formatMonth(label)}</p>
      {payload.filter(p => p.value != null).sort((a, b) => b.value - a.value).map(p => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{p.name === "Elétrico" ? `€${p.value.toFixed(3)}/kWh` : `€${p.value.toFixed(3)}/L`}</span>
        </div>
      ))}
    </div>
  );
}

export default function FuelPriceHistoryChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState({});

  const load = () => {
    setLoading(true);
    setError(null);
    base44.functions.invoke("getFuelPriceHistory", {})
      .then(res => setData(res.data))
      .catch(() => setError("Não foi possível carregar o histórico."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
        A carregar histórico de preços...
      </div>
    );
  }

  if (error || !data || !data.points?.length) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 text-center text-sm text-muted-foreground">
        {error || "Sem dados históricos disponíveis."}
      </div>
    );
  }

  const fuels = (data.fuels || []).filter(f => !hidden[f]);
  const yDomain = data.hasElectricity ? [0, 2.2] : ["auto", "auto"];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Evolução de Preços (12 meses)</p>
            <p className="text-[10px] text-muted-foreground truncate">Preço médio mensal · DGEG {data.hasElectricity ? "· Elétrico do teu histórico" : ""}</p>
          </div>
        </div>
        <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <ChartWrapper height={280}>
          {(w, h) => (
            <ResponsiveContainer width={w} height={h}>
              <LineChart data={data.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `€${v.toFixed(2)}`}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  iconType="circle"
                  onClick={(e) => setHidden(prev => ({ ...prev, [e.dataKey || e.value]: !prev[e.dataKey || e.value] }))}
                />
                {fuels.map(f => (
                  <Line
                    key={f}
                    type="monotone"
                    dataKey={f}
                    stroke={FUEL_COLORS[f] || "#888"}
                    strokeWidth={f === "Elétrico" ? 2.5 : 2}
                    strokeDasharray={f === "Elétrico" ? "5 3" : undefined}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                    yAxisId={0}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartWrapper>
        <p className="text-[9px] text-muted-foreground text-center mt-1">
          Combustíveis: fonte DGEG (preço médio nacional) · Elétrico: média ponderada dos teus carregamentos
        </p>
      </div>
    </div>
  );
}