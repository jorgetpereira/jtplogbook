import { useState } from "react";
import { ChevronDown, ChevronUp, Check, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_ITEMS = [
  { label: "Óleo Motor", category: "Motor" },
  { label: "Filtro de Óleo", category: "Filtros" },
  { label: "Filtro de Ar", category: "Filtros" },
  { label: "Filtro de Combustível", category: "Filtros" },
  { label: "Filtro de Habitáculo", category: "Filtros" },
  { label: "Óleo de Travões", category: "Travões" },
  { label: "Pastilhas de Travão (Frente)", category: "Travões" },
  { label: "Pastilhas de Travão (Trás)", category: "Travões" },
  { label: "Discos de Travão (Frente)", category: "Travões" },
  { label: "Discos de Travão (Trás)", category: "Travões" },
  { label: "Óleo de Caixa", category: "Transmissão" },
  { label: "Correia de Distribuição", category: "Correia/Corrente" },
  { label: "Velas de Ignição", category: "Motor" },
  { label: "Bateria", category: "Elétrico" },
  { label: "Pneus", category: "Pneus" },
  { label: "Amortecedores", category: "Suspensão" },
  { label: "Escovas Limpa-Para-brisas", category: "Outro" },
  { label: "Líquido de Refrigeração", category: "Motor" },
];

export default function ServiceItemsChecklist({ parts, onChange, expenseDefaults }) {
  const [open, setOpen] = useState(false);

  const toggleItem = (item) => {
    const existing = parts.find(p => p.name === item.label);
    if (existing) {
      onChange("parts", parts.filter(p => p.name !== item.label));
    } else {
      onChange("parts", [
        ...parts,
        {
          name: item.label,
          category: item.category,
          brand: "",
          reference: "",
          warranty_date: "",
          installation_date: expenseDefaults?.date || "",
          installation_mileage: expenseDefaults?.mileage_at_expense || undefined,
          cost: "",
          supplier: expenseDefaults?.location || "",
        },
      ]);
    }
  };

  const replacedCount = parts.filter(p => p.name && SERVICE_ITEMS.some(s => s.label === p.name)).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          Itens de Revisão
          {replacedCount > 0 && (
            <span className="bg-green-100 text-green-700 rounded-full text-xs px-1.5 py-0.5 font-semibold">{replacedCount} trocados</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="p-3 space-y-1.5">
          <p className="text-[11px] text-muted-foreground mb-2">Toca num item para marcar como trocado. Os itens trocados ficam verdes e são adicionados como peças.</p>
          <div className="grid grid-cols-1 gap-1.5">
            {SERVICE_ITEMS.map(item => {
              const isReplaced = parts.some(p => p.name === item.label);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left",
                    isReplaced
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.label}
                    <span className="text-[10px] text-muted-foreground/70">{item.category}</span>
                  </span>
                  <span className={cn(
                    "inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold shrink-0",
                    isReplaced
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-transparent border-muted-foreground/30 text-transparent"
                  )}>
                    <Check className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}