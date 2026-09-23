import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, X } from "lucide-react";

const PART_CATEGORIES = ["Motor","Travões","Pneus","Suspensão","Elétrico","Transmissão","Filtros","Correia/Corrente","Iluminação","Outro"];

function PartEntry({ part, onChange, onRemove }) {
  return (
    <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Componente</span>
        <button type="button" onClick={onRemove} className="text-destructive hover:text-destructive/80">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input value={part.name} onChange={e => onChange("name", e.target.value)} placeholder="Ex: Filtro de óleo" required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select value={part.category} onValueChange={v => onChange("category", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{PART_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marca</Label>
          <Input className="h-8 text-xs" value={part.brand} onChange={e => onChange("brand", e.target.value)} placeholder="Ex: Bosch" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Referência</Label>
          <Input className="h-8 text-xs" value={part.reference} onChange={e => onChange("reference", e.target.value)} placeholder="Nº peça" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Garantia até</Label>
          <Input className="h-8 text-xs" type="date" value={part.warranty_date} onChange={e => onChange("warranty_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data instalação</Label>
          <Input className="h-8 text-xs" type="date" value={part.installation_date} onChange={e => onChange("installation_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo (€)</Label>
          <Input className="h-8 text-xs" type="number" step="0.01" value={part.cost} onChange={e => onChange("cost", e.target.value)} placeholder="0.00" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Fornecedor / Oficina</Label>
          <Input className="h-8 text-xs" value={part.supplier} onChange={e => onChange("supplier", e.target.value)} placeholder="Nome da oficina ou loja" />
        </div>
      </div>
    </div>
  );
}

function DocEntry({ doc, onChange, onRemove }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange("file_url", file_url);
    if (!doc.title) onChange("title", file.name.replace(/\.[^.]+$/, ""));
    setUploading(false);
  };

  return (
    <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Documento</span>
        <button type="button" onClick={onRemove} className="text-destructive hover:text-destructive/80">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Título *</Label>
          <Input value={doc.title} onChange={e => onChange("title", e.target.value)} placeholder="Ex: Fatura revisão" required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select value={doc.category} onValueChange={v => onChange("category", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              {["Fatura","Manual","Seguro","Inspeção","Garantia","Contrato","Outro"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ficheiro</Label>
          <label className="flex items-center gap-1.5 h-8 px-2 border border-dashed border-border rounded-md text-xs text-muted-foreground cursor-pointer hover:bg-muted transition-colors">
            <Upload className="w-3 h-3" />
            {uploading ? "A carregar..." : doc.file_url ? "✓ Carregado" : "Escolher"}
            <input type="file" className="hidden" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          </label>
        </div>
      </div>
    </div>
  );
}

const SUB_TO_CATEGORY = {
  "Pneus": "Pneus",
  "Revisão": "Motor",
  "Reparação de Peça": "Outro",
  "Correia/Corrente": "Correia/Corrente",
  "Travões": "Travões",
  "Elétrico": "Elétrico",
  "Filtros": "Filtros",
  "Suspensão": "Suspensão",
};

const newDoc = () => ({ title: "", category: "Fatura", file_url: "" });

export default function ExpenseDetailsSection({ parts, docs, onChange, expenseDefaults }) {
  const newPart = () => ({
    name: "",
    category: SUB_TO_CATEGORY[expenseDefaults?.sub_category] || "Outro",
    brand: "",
    reference: "",
    warranty_date: "",
    installation_date: expenseDefaults?.date || "",
    cost: expenseDefaults?.amount || "",
    supplier: expenseDefaults?.location || "",
  });
  const [open, setOpen] = useState(false);

  const updatePart = (i, key, val) => {
    const updated = parts.map((p, idx) => idx === i ? { ...p, [key]: val } : p);
    onChange("parts", updated);
  };
  const removePart = (i) => onChange("parts", parts.filter((_, idx) => idx !== i));

  const updateDoc = (i, key, val) => {
    const updated = docs.map((d, idx) => idx === i ? { ...d, [key]: val } : d);
    onChange("docs", updated);
  };
  const removeDoc = (i) => onChange("docs", docs.filter((_, idx) => idx !== i));

  const totalItems = parts.length + docs.length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Adicionar Detalhes
          {totalItems > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full text-xs px-1.5 py-0.5">{totalItems}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Parts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peças / Componentes</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onChange("parts", [...parts, newPart()])}>
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>
            {parts.map((p, i) => (
              <PartEntry key={i} part={p} onChange={(k, v) => updatePart(i, k, v)} onRemove={() => removePart(i)} />
            ))}
          </div>

          {/* Docs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documentos</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onChange("docs", [...docs, newDoc()])}>
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>
            {docs.map((d, i) => (
              <DocEntry key={i} doc={d} onChange={(k, v) => updateDoc(i, k, v)} onRemove={() => removeDoc(i)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}