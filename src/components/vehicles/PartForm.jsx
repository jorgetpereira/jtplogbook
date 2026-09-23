import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Motor", "Travões", "Pneus", "Suspensão", "Elétrico", "Transmissão", "Filtros", "Correia/Corrente", "Iluminação", "Outro"];

export default function PartForm({ part, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: part?.name || "",
    category: part?.category || "",
    brand: part?.brand || "",
    reference: part?.reference || "",
    installation_date: part?.installation_date || "",
    installation_mileage: part?.installation_mileage || "",
    warranty_date: part?.warranty_date || "",
    next_replacement_date: part?.next_replacement_date || "",
    next_replacement_km: part?.next_replacement_km || "",
    cost: part?.cost || "",
    supplier: part?.supplier || "",
    notes: part?.notes || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      installation_mileage: form.installation_mileage ? Number(form.installation_mileage) : undefined,
      next_replacement_km: form.next_replacement_km ? Number(form.next_replacement_km) : undefined,
      cost: form.cost ? Number(form.cost) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Componente *</Label>
        <Input value={form.name} onChange={e => set("name", e.target.value)} required placeholder="Ex: Pastilhas de travão dianteiras" />
      </div>
      <div className="space-y-2">
        <Label>Categoria *</Label>
        <Select value={form.category} onValueChange={v => set("category", v)}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Marca</Label>
          <Input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Ex: Bosch" />
        </div>
        <div className="space-y-2">
          <Label>Referência</Label>
          <Input value={form.reference} onChange={e => set("reference", e.target.value)} placeholder="Nº de peça" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Data de Instalação</Label>
          <Input type="date" value={form.installation_date} onChange={e => set("installation_date", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>km na Instalação</Label>
          <Input type="number" value={form.installation_mileage} onChange={e => set("installation_mileage", e.target.value)} placeholder="km" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Garantia até</Label>
          <Input type="date" value={form.warranty_date} onChange={e => set("warranty_date", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Custo (€)</Label>
          <Input type="number" step="0.01" value={form.cost} onChange={e => set("cost", e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Próx. Substituição (data)</Label>
          <Input type="date" value={form.next_replacement_date} onChange={e => set("next_replacement_date", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Próx. Substituição (km)</Label>
          <Input type="number" value={form.next_replacement_km} onChange={e => set("next_replacement_km", e.target.value)} placeholder="km" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Fornecedor / Oficina</Label>
        <Input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Nome da oficina ou loja" />
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações adicionais" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{part ? "Guardar" : "Adicionar"}</Button>
      </div>
    </form>
  );
}