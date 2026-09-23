import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Loader2, Plus, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Motor", "Travões", "Elétrico", "Eletrónica", "Pneus", "Suspensão", "Transmissão", "Ar Condicionado", "Outro"];

export default function VehicleIssueForm({ vehicle, onSave, issue }) {
  const isEdit = !!issue;
  const [title, setTitle] = useState(issue?.title || "");
  const [category, setCategory] = useState(issue?.category || "Outro");
  const [maintenanceType, setMaintenanceType] = useState(issue?.maintenance_type || "Corretiva");
  const [notes, setNotes] = useState(issue?.notes || "");
  const [detectedDate, setDetectedDate] = useState(issue?.detected_date || format(new Date(), "yyyy-MM-dd"));
  const [odometer, setOdometer] = useState(
    issue?.odometer != null ? issue.odometer : (vehicle?.current_mileage || vehicle?.mileage || "")
  );
  const [images, setImages] = useState(issue?.image_urls || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(file_url);
      }
      setImages(prev => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        vehicle_id: vehicle.id,
        title: title.trim(),
        category,
        maintenance_type: maintenanceType,
        notes: notes.trim() || undefined,
        detected_date: detectedDate || undefined,
        odometer: odometer ? Number(odometer) : undefined,
        image_urls: images.length ? images : undefined,
      });
      if (!isEdit) {
        setTitle("");
        setNotes("");
        setImages([]);
        setCategory("Outro");
        setMaintenanceType("Corretiva");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {isEdit ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {isEdit ? "Editar Registo" : "Nova Avaria / Nota"}
      </div>
      <div>
        <Label className="text-xs">Título</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Luz do motor acesa" className="h-9 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Categoria</Label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={detectedDate} onChange={e => setDetectedDate(e.target.value)} className="h-9 mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Odómetro (km)</Label>
        <Input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="km" className="h-9 mt-1" />
      </div>
      <div>
        <Label className="text-xs">Notas</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Descreva o problema, sintomas, quando ocorre..." rows={3} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs">Screenshots / Fotos</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {images.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <label className={cn(
            "w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors",
            uploading && "opacity-50 pointer-events-none"
          )}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <ImagePlus className="w-4 h-4 text-muted-foreground" />}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>
        </div>
      </div>
      <Button onClick={submit} disabled={!title.trim() || saving || uploading} className="w-full h-9 text-sm">
        {saving ? "A guardar..." : isEdit ? "Guardar Alterações" : "Adicionar Registo"}
      </Button>
    </div>
  );
}