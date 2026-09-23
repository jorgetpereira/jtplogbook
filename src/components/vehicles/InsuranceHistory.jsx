import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ShieldPlus, Pencil, Trash2 } from "lucide-react";
import GreenCardPopover from "./GreenCardPopover";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InsuranceHistory({ insurances, onEdit, onDelete, onAdd }) {
  const sorted = useMemo(
    () => [...insurances].sort((a, b) => (a.start_date || "").localeCompare(b.start_date || "")),
    [insurances]
  );

  const chartData = useMemo(
    () => sorted
      .filter((i) => i.premium_amount != null && i.start_date)
      .map((i) => ({
        year: format(new Date(i.start_date + "T12:00:00"), "yyyy"),
        valor: Number(i.premium_amount),
        insurer: i.insurer,
      })),
    [sorted]
  );

  const hasChart = chartData.length >= 2;
  const first = chartData[0]?.valor;
  const last = chartData[chartData.length - 1]?.valor;
  const diff = hasChart && first != null && last != null ? last - first : null;
  const pctChange = hasChart && first > 0 ? ((last - first) / first) * 100 : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between sticky top-0 bg-background z-10 -py-1">
        <p className="text-sm text-muted-foreground">
          {insurances.length === 0 ? "Nenhuma apólice registada" : `${insurances.length} apólice${insurances.length > 1 ? "s" : ""} registada${insurances.length > 1 ? "s" : ""}`}
        </p>
        <Button size="sm" className="gap-1.5 rounded-xl shrink-0" onClick={onAdd}>
          <ShieldPlus className="w-4 h-4" /> Adicionar Seguro
        </Button>
      </div>

      {hasChart && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-primary" />
            Oscilação do Prémio Anual
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Evolução do valor pago por ano
            {pctChange != null && (
              <span className={cn("ml-2 font-semibold", pctChange > 0 ? "text-destructive" : "text-emerald-600")}>
                {pctChange > 0 ? "▲" : "▼"} {Math.abs(pctChange).toFixed(1)}%
              </span>
            )}
          </p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[dataMin => Math.floor(dataMin / 10) * 10, dataMax => Math.ceil(dataMax / 10) * 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={45} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  formatter={(v) => `€${Number(v).toFixed(2)}`}
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {diff != null && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Diferença total: <span className={cn("font-semibold", diff > 0 ? "text-destructive" : "text-emerald-600")}>
                {diff > 0 ? "+" : ""}€{diff.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Sem seguros registados.</div>
      ) : (
        <div className="space-y-3">
          {[...sorted].reverse().map((ins) => {
            const endDate = new Date(ins.end_date + "T12:00:00");
            const today = new Date();
            const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            const expired = daysLeft < 0;
            const soon = !expired && daysLeft <= 30;
            return (
              <div key={ins.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base">{ins.insurer}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{ins.coverage_type}</span>
                      {(expired || soon) && (
                        <span className={cn("text-xs font-medium", expired ? "text-destructive" : "text-amber-600")}>
                          {expired ? "Expirado" : `Expira em ${daysLeft}d`}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="truncate">📋 {ins.policy_number}</span>
                      {ins.start_date && <span className="truncate">📅 {format(new Date(ins.start_date + "T12:00:00"), "d MMM yyyy", { locale: pt })} → {format(endDate, "d MMM yyyy", { locale: pt })}</span>}
                      {ins.agent_name && <span className="truncate">👤 {ins.agent_name}</span>}
                      {ins.agent_phone && <span className="truncate">📞 {ins.agent_phone}</span>}
                      {ins.premium_amount != null && <span className="font-semibold text-foreground text-sm">€{Number(ins.premium_amount).toFixed(2)}</span>}
                    </div>
                    {ins.green_card_url && (
                      <div className="mt-2">
                        <GreenCardPopover url={ins.green_card_url} />
                      </div>
                    )}
                    {ins.notes && <p className="text-xs text-muted-foreground mt-1 italic">{ins.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(ins)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(ins.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}