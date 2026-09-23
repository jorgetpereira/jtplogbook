import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, Plus, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DEFAULT_ITEMS = [
  { label: "Nível de óleo do motor", checked: true, notes: "" },
  { label: "Líquido de travões", checked: true, notes: "" },
  { label: "Líquido de refrigeração", checked: true, notes: "" },
  { label: "Líquido limpa-para-brisas", checked: true, notes: "" },
  { label: "Estado dos pneus (pressão/desgaste)", checked: true, notes: "" },
  { label: "Luzes (médios/máximos/stop/piscas)", checked: true, notes: "" },
  { label: "Bateria (terminais/carga)", checked: true, notes: "" },
  { label: "Limpa-para-brisas (escovas)", checked: true, notes: "" },
  { label: "Correias e mangueiras", checked: true, notes: "" },
  { label: "Filtros (ar/combustível/habitáculo)", checked: true, notes: "" },
];

export default function ChecklistForm({ vehicle, checklist, onSave, onCancel }) {
  const isEdit = !!checklist;
  const [date, setDate] = useState(checklist?.date || format(new Date(), "yyyy-MM-dd"));
  const [odometer, setOdometer] = useState(
    checklist?.odometer != null ? checklist.odometer : (vehicle?.mileage || "")
  );
  const [items, setItems] = useState(checklist?.items?.length ? checklist.items : DEFAULT_ITEMS.map(i => ({ ...i })));
  const [overallStatus, setOverallStatus] = useState(checklist?.overall_status || "OK");
  const [notes, setNotes] = useState(checklist?.notes || "");
  const [saving, setSaving] = useState(false);

  const toggleItem = (idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  };

  const updateItemNotes = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, notes: val } : it));
  };

  const addItem = () => {
    setItems(prev => [...prev, { label: "", checked: true, notes: "" }]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLabel = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, label: val } : it));
  };

  const autoStatus = () => {
    const allChecked = items.every(i => i.checked);
    if (allChecked) setOverallStatus("OK");
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        vehicle_id: vehicle.id,
        date,
        odometer: odometer ? Number(odometer) : undefined,
        overall_status: overallStatus,
        items: items.filter(i => i.label.trim()),
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const STATUS_STYLES = {
    "OK": "bg-green-100 text-green-700 border-green-300",
    "Atenção": "bg-amber-100 text-amber-700 border-amber-300",
    "Crítico": "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {isEdit ? <Pencil className="w-3.5 h-3.5" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
        {isEdit ? "Editar Checklist" : "Nova Checklist de Inspeção"}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Odómetro (km)</Label>
          <Input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="km" className="h-9 mt-1" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Estado Geral</Label>
        <div className="flex gap-2 mt-1">
          {["OK", "Atenção", "Crítico"].map(s => (
            <button
              key={s}
              onClick={() => setOverallStatus(s)}
              className={cn(
                "flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors",
                overallStatus === s ? STATUS_STYLES[s] : "bg-muted text-muted-foreground border-border"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Itens de Verificação</Label>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2">
            <button
              onClick={() => { toggleItem(idx); setTimeout(autoStatus, 0); }}
              className={cn(
                "shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-colors mt-0.5",
                item.checked ? "bg-green-500 border-green-500 text-white" : "bg-card border-border text-transparent"
              )}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 min-w-0 space-y-1">
              <input
                value={item.label}
                onChange={e => updateLabel(idx, e.target.value)}
                placeholder="Item a verificar..."
                className="w-full bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-primary"
              />
              {!item.checked && (
                <input
                  value={item.notes || ""}
                  onChange={e => updateItemNotes(idx, e.target.value)}
                  placeholder="Notas sobre o problema..."
                  className="w-full bg-transparent text-xs text-muted-foreground outline-none"
                />
              )}
            </div>
            <button onClick={() => removeItem(idx)} className="shrink-0 text-muted-foreground hover:text-destructive p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">Notas Gerais</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais..." rows={2} className="mt-1" />
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1 h-9 text-sm">Cancelar</Button>
        )}
        <Button onClick={submit} disabled={saving || !items.some(i => i.label.trim())} className="flex-1 h-9 text-sm">
          {saving ? "A guardar..." : isEdit ? "Guardar" : "Criar Checklist"}
        </Button>
      </div>
    </div>
  );
}