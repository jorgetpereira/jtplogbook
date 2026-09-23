import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Pencil, Plus, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function LoanDialog({ vehicle, onClose }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [loanAmount, setLoanAmount] = useState(vehicle?.loan_amount || "");
  const [savingAmount, setSavingAmount] = useState(false);

  const load = async () => {
    if (!vehicle) return;
    setLoading(true);
    try {
      const all = await base44.entities.Expense.filter(
        { vehicle_id: vehicle.id, category: "Empréstimos" },
        "-date"
      );
      setExpenses(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoanAmount(vehicle?.loan_amount || "");
    load();
  }, [vehicle?.id]);

  const totalLoan = Number(loanAmount) || 0;
  const paidSoFar = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = totalLoan - paidSoFar;
  const pctPaid = totalLoan > 0 ? Math.min(100, (paidSoFar / totalLoan) * 100) : 0;

  const handleSaveAmount = async () => {
    setSavingAmount(true);
    try {
      await base44.entities.Vehicle.update(vehicle.id, {
        loan_amount: loanAmount ? Number(loanAmount) : undefined,
      });
      setEditingAmount(false);
    } finally {
      setSavingAmount(false);
    }
  };

  const handleDeletePayment = async (id) => {
    await base44.entities.Expense.delete(id);
    load();
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col gap-3 p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Empréstimo / Crédito
          </DialogTitle>
        </DialogHeader>
        {vehicle && (
          <p className="text-xs text-muted-foreground -mt-2 shrink-0">
            {vehicle.brand} {vehicle.model} · Saldo e histórico de pagamentos.
          </p>
        )}

        {/* Loan amount summary card */}
        <div className="shrink-0 rounded-2xl border border-pink-200 bg-pink-50/70 dark:bg-pink-950/30 dark:border-pink-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest text-pink-700 dark:text-pink-400">VALOR DO EMPRÉSTIMO</span>
            {!editingAmount ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditingAmount(true)}>
                <Pencil className="w-3 h-3" /> Editar
              </Button>
            ) : null}
          </div>

          {!editingAmount ? (
            <div className="text-2xl font-bold text-pink-700 dark:text-pink-400">
              {totalLoan > 0 ? totalLoan.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"}
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Valor Total (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="Ex: 25000"
                  className="h-9"
                />
              </div>
              <Button size="sm" className="h-9 gap-1" onClick={handleSaveAmount} disabled={savingAmount}>
                <Check className="w-3.5 h-3.5" /> {savingAmount ? "..." : "Guardar"}
              </Button>
            </div>
          )}

          {totalLoan > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Pago</div>
                  <div className="text-sm font-bold">{paidSoFar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Falta pagar</div>
                  <div className={cn("text-sm font-bold", remaining <= 0 ? "text-green-600" : "text-pink-700 dark:text-pink-400")}>
                    {remaining.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                  </div>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-pink-100 dark:bg-pink-950/50 overflow-hidden">
                <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${pctPaid}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground text-right">{pctPaid.toFixed(1)}% liquidado</div>
              {remaining <= 0 && (
                <p className="text-xs text-green-600 font-medium">✓ Empréstimo liquidado!</p>
              )}
            </>
          )}
        </div>

        {/* Payment history */}
        <div className="shrink-0 flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-muted-foreground">HISTÓRICO DE PAGAMENTOS</span>
          <span className="text-xs text-muted-foreground">{expenses.length} registo(s)</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8 shrink-0">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Sem pagamentos registados.
            <br />
            Usa o botão + para adicionar pagamentos via registo de Empréstimo.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="w-9 h-9 rounded-lg bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{Number(e.amount).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
                    {e.sub_category && <span className="text-[11px] text-muted-foreground">· {e.sub_category}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(e.date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
                    {e.description ? ` · ${e.description}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDeletePayment(e.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}