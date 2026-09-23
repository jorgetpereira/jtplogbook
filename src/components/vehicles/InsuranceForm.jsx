import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileText, Upload, X } from "lucide-react";

const COVERAGE_TYPES = [
  "Responsabilidade Civil",
  "Multirriscos",
  "Todos os Riscos",
  "Outro",
];

export default function InsuranceForm({ insurance, onSave, onCancel }) {
  const [form, setForm] = useState({
    insurer: insurance?.insurer || "",
    policy_number: insurance?.policy_number || "",
    agent_name: insurance?.agent_name || "",
    agent_phone: insurance?.agent_phone || "",
    start_date: insurance?.start_date || "",
    end_date: insurance?.end_date || "",
    premium_amount: insurance?.premium_amount || "",
    coverage_type: insurance?.coverage_type || "Responsabilidade Civil",
    green_card_url: insurance?.green_card_url || "",
    notes: insurance?.notes || "",
    is_active: insurance?.is_active !== false,
  });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((prev) => ({ ...prev, green_card_url: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      premium_amount: form.premium_amount ? Number(form.premium_amount) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Seguradora *</Label>
          <Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} required placeholder="Ex: Fidelidade" />
        </div>
        <div className="space-y-2">
          <Label>Nº da Apólice *</Label>
          <Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} required placeholder="Ex: 2024-123456" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Agente</Label>
          <Input value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} placeholder="Nome do agente" />
        </div>
        <div className="space-y-2">
          <Label>Contacto</Label>
          <Input value={form.agent_phone} onChange={(e) => setForm({ ...form, agent_phone: e.target.value })} placeholder="Telefone/email" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Início *</Label>
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Termo *</Label>
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prémio Anual (€) *</Label>
          <Input type="number" step="0.01" value={form.premium_amount} onChange={(e) => setForm({ ...form, premium_amount: e.target.value })} required placeholder="Ex: 350.00" />
        </div>
        <div className="space-y-2">
          <Label>Cobertura</Label>
          <select
            value={form.coverage_type}
            onChange={(e) => setForm({ ...form, coverage_type: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {COVERAGE_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Carta Verde</Label>
        {form.green_card_url ? (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <a href={form.green_card_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline truncate flex-1">Ver carta verde</a>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ ...form, green_card_url: "" })}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{uploading ? "A enviar..." : "Anexar carta verde"}</span>
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleUpload(e.target.files?.[0])} disabled={uploading} />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais" />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        <Label>Apólice vigente</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{insurance ? "Guardar" : "Criar"}</Button>
      </div>
    </form>
  );
}