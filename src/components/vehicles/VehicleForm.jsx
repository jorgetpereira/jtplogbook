import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { Camera, Link, Upload, X, Loader2 } from "lucide-react";

const fuelTypes = [
  { value: "Gasóleo",      label: "Gasóleo",       icon: "⛽" },
  { value: "Gasolina",     label: "Gasolina",      icon: "⛽" },
  { value: "Elétrico",     label: "Elétrico",      icon: "⚡" },
  { value: "Híbrido",      label: "Híbrido",       icon: "🔋" },
  { value: "Híbrido EREV", label: "Híbrido EREV",  icon: "🔋" },
  { value: "GPL",          label: "GPL",           icon: "🟢" },
];

export default function VehicleForm({ vehicle, onSave, onCancel }) {
  const [form, setForm] = useState({
    brand: vehicle?.brand || "",
    model: vehicle?.model || "",
    year: vehicle?.year || "",
    license_plate: vehicle?.license_plate || "",
    registration_date: vehicle?.registration_date || "",
    fuel_type: vehicle?.fuel_type || "",
    color: vehicle?.color || "",
    mileage: vehicle?.mileage || "",
    tank_size: vehicle?.tank_size || "",
    fuel_reserve_liters: vehicle?.fuel_reserve_liters ?? 5,
    fuel_range: vehicle?.fuel_range || "",
    advertised_consumption: vehicle?.advertised_consumption || "",
    advertised_consumption_electric: vehicle?.advertised_consumption_electric || "",
    battery_capacity: vehicle?.battery_capacity || "",
    electric_range: vehicle?.electric_range || "",
    battery_reserve_pct: vehicle?.battery_reserve_pct ?? "",
    loan_amount: vehicle?.loan_amount || "",
    last_maintenance_date: vehicle?.last_maintenance_date || "",
    last_maintenance_km: vehicle?.last_maintenance_km || "",
    notes: vehicle?.notes || "",
    is_active: vehicle?.is_active !== false,
    image_url: vehicle?.image_url || "",
  });
  const [imageMode, setImageMode] = useState(null); // null | "upload" | "url"
  const [urlInput, setUrlInput] = useState(vehicle?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setImageMode(null);
    setUploading(false);
  };

  const handleUrlConfirm = () => {
    setForm(f => ({ ...f, image_url: urlInput }));
    setImageMode(null);
  };

  const isCombustion = ["Gasóleo", "Gasolina", "GPL"].includes(form.fuel_type);
  const isHybrid = form.fuel_type === "Híbrido";
  const isEREV = form.fuel_type === "Híbrido EREV";
  const isElectric = form.fuel_type === "Elétrico";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      year: form.year ? Number(form.year) : undefined,
      mileage: form.mileage ? Number(form.mileage) : undefined,
      tank_size: form.tank_size ? Number(form.tank_size) : undefined,
      fuel_reserve_liters: form.fuel_reserve_liters !== "" ? Number(form.fuel_reserve_liters) : 5,
      fuel_range: form.fuel_range ? Number(form.fuel_range) : undefined,
      battery_capacity: form.battery_capacity ? Number(form.battery_capacity) : undefined,
      electric_range: form.electric_range ? Number(form.electric_range) : undefined,
      battery_reserve_pct: form.battery_reserve_pct !== "" ? Number(form.battery_reserve_pct) : 0,
      advertised_consumption: form.advertised_consumption ? Number(form.advertised_consumption) : undefined,
      advertised_consumption_electric: form.advertised_consumption_electric ? Number(form.advertised_consumption_electric) : undefined,
      last_maintenance_km: form.last_maintenance_km ? Number(form.last_maintenance_km) : undefined,
      loan_amount: form.loan_amount ? Number(form.loan_amount) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Photo picker */}
      <div className="relative h-32 rounded-xl overflow-hidden bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-border">
        {form.image_url ? (
          <>
            <img src={form.image_url} alt="Foto do veículo" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => { setForm(f => ({ ...f, image_url: "" })); setUrlInput(""); setImageMode(null); }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-card border border-border text-xs font-medium hover:bg-muted transition-colors">
              <Upload className="w-5 h-5 text-primary" />
              Carregar foto
            </button>
            <button type="button" onClick={() => setImageMode("url")}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-card border border-border text-xs font-medium hover:bg-muted transition-colors">
              <Link className="w-5 h-5 text-primary" />
              URL da internet
            </button>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>

      {/* URL input inline */}
      {imageMode === "url" && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-1"
            autoFocus
          />
          <Button type="button" size="sm" onClick={handleUrlConfirm} disabled={!urlInput}>OK</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setImageMode(null)}>✕</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Marca *</Label>
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required placeholder="Ex: Toyota" />
        </div>
        <div className="space-y-2">
          <Label>Modelo *</Label>
          <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required placeholder="Ex: Corolla" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Matrícula *</Label>
          <Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} required placeholder="AA-00-AA" />
        </div>
        <div className="space-y-2">
          <Label>Data de Matrícula</Label>
          <Input type="date" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Combustível *</Label>
          <div className="flex flex-wrap gap-2">
            {fuelTypes.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setForm({ ...form, fuel_type: f.value })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  form.fuel_type === f.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          {form.fuel_type === "Híbrido EREV" && (
            <p className="text-[11px] text-muted-foreground">Motor a combustão apenas como gerador — cálculo de consumo 100% elétrico (kWh/100km) baseado em SOC.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Ano</Label>
          <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" />
        </div>
        <div className="space-y-2">
          <Label>Cor</Label>
          <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Branco" />
        </div>
        <div className="space-y-2">
          <Label>Km</Label>
          <Input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="50000" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data da Última Revisão</Label>
          <Input type="date" value={form.last_maintenance_date} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Km da Última Revisão</Label>
          <Input type="number" value={form.last_maintenance_km} onChange={(e) => setForm({ ...form, last_maintenance_km: e.target.value })} placeholder="0" />
        </div>
      </div>

      {/* Caixa COMBUSTÍVEL */}
      {(isCombustion || isHybrid || isEREV) && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/70 dark:bg-orange-950/30 dark:border-orange-900/50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs font-bold tracking-widest text-orange-700 dark:text-orange-400">COMBUSTÍVEL</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Depósito Total (L)</Label>
              <Input type="number" step="0.1" value={form.tank_size} onChange={(e) => setForm({ ...form, tank_size: e.target.value })} placeholder="Ex: 55" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Reserva (L)</Label>
              <Input type="number" step="0.1" min="0" value={form.fuel_reserve_liters} onChange={(e) => setForm({ ...form, fuel_reserve_liters: e.target.value })} placeholder="5" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Autonomia Combustão (km)</Label>
            <Input type="number" value={form.fuel_range} onChange={(e) => setForm({ ...form, fuel_range: e.target.value })} placeholder="Ex: 700" />
          </div>
          {(isCombustion || isHybrid || isEREV) && (
            <div className="space-y-2">
              <Label className="text-xs">Média Anunciada (L/100km)</Label>
              <Input type="number" step="0.1" value={form.advertised_consumption} onChange={(e) => setForm({ ...form, advertised_consumption: e.target.value })} placeholder="Ex: 5.5" />
            </div>
          )}
        </div>
      )}

      {/* Caixa ELÉTRICO */}
      {(isHybrid || isElectric || isEREV) && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900/50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold tracking-widest text-blue-700 dark:text-blue-400">ELÉTRICO</span>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Bateria (kWh)</Label>
            <Input type="number" step="0.1" value={form.battery_capacity} onChange={(e) => setForm({ ...form, battery_capacity: e.target.value })} placeholder="Ex: 18.1" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Autonomia Elétrica (km)</Label>
            <Input type="number" value={form.electric_range} onChange={(e) => setForm({ ...form, electric_range: e.target.value })} placeholder="Ex: 80" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Reserva Bateria (%)</Label>
            <Input type="number" min={0} max={50} step="1" value={form.battery_reserve_pct} onChange={(e) => setForm({ ...form, battery_reserve_pct: e.target.value })} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Média Anunciada (kWh/100km)</Label>
            <Input type="number" step="0.1" value={form.advertised_consumption_electric} onChange={(e) => setForm({ ...form, advertised_consumption_electric: e.target.value })} placeholder="Ex: 15.0" />
          </div>
        </div>
      )}

      {/* Caixa EMPRÉSTIMO / CRÉDITO */}
      <div className="rounded-2xl border border-pink-200 bg-pink-50/70 dark:bg-pink-950/30 dark:border-pink-900/50 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-pink-500" />
          <span className="text-xs font-bold tracking-widest text-pink-700 dark:text-pink-400">EMPRÉSTIMO / CRÉDITO</span>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Valor Total do Empréstimo/Crédito (€)</Label>
          <Input type="number" step="0.01" value={form.loan_amount} onChange={(e) => setForm({ ...form, loan_amount: e.target.value })} placeholder="Ex: 25000" />
          <p className="text-[11px] text-muted-foreground">Se preenchido, o saldo em falta será calculado automaticamente nos registos de empréstimo.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais" />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        <Label>Veículo ativo</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{vehicle ? "Guardar" : "Criar"}</Button>
      </div>
    </form>
  );
}