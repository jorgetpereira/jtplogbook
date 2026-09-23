import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const types = ["Revisão", "Seguro", "Inspeção", "IUC", "Pneus", "Outro"];

export default function NotificationForm({ vehicles, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    vehicle_id: "",
    title: "",
    message: "",
    type: "",
    due_date: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const isEdit = !!initial;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Veículo *</Label>
        <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
          <SelectContent>
            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Título *</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex: Revisão anual" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data Limite *</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mensagem</Label>
        <Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Nota adicional" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{isEdit ? "Guardar" : "Criar"}</Button>
      </div>
    </form>
  );
}