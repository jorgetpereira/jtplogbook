import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Upload } from "lucide-react";

const CATEGORIES = ["Fatura", "Manual", "Seguro", "Inspeção", "Garantia", "Contrato", "Outro"];

export default function DocumentForm({ doc, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: doc?.title || "",
    category: doc?.category || "",
    file_url: doc?.file_url || "",
    date: doc?.date || "",
    notes: doc?.notes || "",
  });
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("file_url", file_url);
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Título *</Label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} required placeholder="Ex: Fatura revisão 2024" />
      </div>
      <div className="space-y-2">
        <Label>Categoria *</Label>
        <Select value={form.category} onValueChange={v => set("category", v)}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Data</Label>
        <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Ficheiro</Label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? "A carregar..." : form.file_url ? "Substituir ficheiro" : "Escolher ficheiro"}
            <input type="file" className="hidden" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
          </label>
          {form.file_url && <span className="text-xs text-green-600 font-medium">✓ Carregado</span>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{doc ? "Guardar" : "Adicionar"}</Button>
      </div>
    </form>
  );
}