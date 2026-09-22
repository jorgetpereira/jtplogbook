import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { saveCache, loadCache } from "@/lib/dataCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultForm = {
  vehicle_id: "",
  start_datetime: "",
  end_datetime: "",
  duration_minutes: "",
  soc_start_pct: "",
  kwh_end: "",        // KWh início (estado da bateria no início)
  range_km: "",       // Autonomia início
  soc_end_pct: "",    // Percentagem fim
  kwh_added: "",      // KWh a carregar (adicionados)
  location_type: "Casa",
  location_name: "",
  odometer: "",
  price_per_kwh: "",
  total_cost: "",
  car_avg_consumption: "",
  notes: "",
};

function usableFraction(soc, reserve) {
  // Marca preserva `reserve`% no fundo: a 0% usável não há autonomia.
  // usable = (soc − reserve) / (100 − reserve), limitado a [0, 1]
  if (soc == null || isNaN(soc)) return null;
  const r = reserve || 0;
  const frac = (soc - r) / (100 - r);
  return Math.max(0, Math.min(1, frac));
}

function calcDerived(next, vehicles) {
  const vehicle = vehicles.find(v => v.id === next.vehicle_id);
  const batteryKwh = vehicle?.battery_capacity || null;
  const reserve = vehicle?.battery_reserve_pct || 0;
  const electricRange = vehicle?.electric_range || vehicle?.fuel_range || null;

  const socStart = parseFloat(next.soc_start_pct);
  const socEnd = parseFloat(next.soc_end_pct);

  if (batteryKwh && !isNaN(socStart)) {
    const usableStart = usableFraction(socStart, reserve);

    // kWh início = bateria * % usável (acima da reserva)
    const kwhStart = +(batteryKwh * usableStart).toFixed(2);
    next.kwh_end = kwhStart;

    // Autonomia início = autonomia_total * % usável
    if (electricRange) {
      next.range_km = +(electricRange * usableStart).toFixed(0);
    }

    if (!isNaN(socEnd)) {
      const usableEnd = usableFraction(socEnd, reserve);
      const kwhEnd = +(batteryKwh * usableEnd).toFixed(2);
      const kwhAdded = +(kwhEnd - kwhStart).toFixed(2);
      if (kwhAdded >= 0) {
        next.kwh_added = kwhAdded;
      }
    }
  }

  // Auto-calc duration
  if (next.start_datetime && next.end_datetime) {
    const diff = (new Date(next.end_datetime) - new Date(next.start_datetime)) / 60000;
    if (diff > 0) next.duration_minutes = Math.round(diff);
  }

  return next;
}

export default function ChargingForm({ charging, vehicles, lastCharging, history, onSave, onCancel }) {
  const isEditing = !!charging;

  // Último preço/kWh registado para um dado local (Casa/Fora)
  const lastPriceFor = (locType) => {
    const found = (history || []).find(c => c.location_type === locType && c.price_per_kwh != null && !isNaN(Number(c.price_per_kwh)));
    return found ? Number(found.price_per_kwh) : null;
  };

  const [evLocations, setEvLocations] = useState([]);
  const [customLocation, setCustomLocation] = useState(false);

  useEffect(() => {
    base44.entities.Location.filter({ type: "Eletricidade" })
      .then((locs) => {
        setEvLocations(locs);
        saveCache("ev_locations", locs);
      })
      // Sem rede: usa a última lista guardada em cache.
      .catch(() => setEvLocations(loadCache("ev_locations") || []));
  }, []);

  const [form, setForm] = useState(() => {
    if (charging) return { ...defaultForm, ...Object.fromEntries(Object.entries(charging).map(([k, v]) => [k, v ?? ""])) };
    const base = { ...defaultForm, vehicle_id: vehicles[0]?.id || "", soc_end_pct: "100" };
    if (lastCharging) {
      base.odometer = lastCharging.odometer ?? "";
      base.total_cost = "";
      base.location_type = lastCharging.location_type ?? "Casa";
      base.location_name = lastCharging.location_name ?? "";
    }
    // Assumir último preço/kWh do local selecionado (apenas em criação)
    const lastPrice = lastPriceFor(base.location_type);
    if (lastPrice != null) base.price_per_kwh = lastPrice;
    return base;
  });

  // Validate odometer: block if strictly less than previous, allow equal
  const [odoError, setOdoError] = useState(null);

  const validateOdo = (val) => {
    if (!val || !minOdometer) return null;
    const km = parseFloat(val);
    if (km < minOdometer) return `O odómetro (${km.toLocaleString("pt")} km) é inferior ao último registo (${minOdometer.toLocaleString("pt")} km). Corrige o valor.`;
    return null;
  };

  const minOdometer = !charging && lastCharging?.odometer ? lastCharging.odometer : undefined;

  useEffect(() => {
    if (!charging && form.vehicle_id) {
      setForm(f => calcDerived({ ...f }, vehicles));
    }
  }, []);

  const set = (key, val) => setForm(f => {
    let next = { ...f, [key]: val };
    if (["vehicle_id", "soc_start_pct", "soc_end_pct"].includes(key)) {
      next = calcDerived(next, vehicles);
    }
    if (key === "start_datetime" || key === "end_datetime") {
      if (next.start_datetime && next.end_datetime) {
        const diff = (new Date(next.end_datetime) - new Date(next.start_datetime)) / 60000;
        if (diff > 0) next.duration_minutes = Math.round(diff);
      }
    }
    // Ao mudar o local, assumir o último preço/kWh desse local (apenas em criação)
    if (key === "location_type" && !isEditing) {
      const lastPrice = lastPriceFor(val);
      if (lastPrice != null) {
        next.price_per_kwh = lastPrice;
        const kwhVal = parseFloat(next.kwh_added);
        if (!isNaN(kwhVal) && kwhVal > 0) next.total_cost = +(lastPrice * kwhVal).toFixed(2);
      }
    }
    // Cálculo custo ↔ preço/kWh
    const kwh = parseFloat(next.kwh_added);
    if (key === "price_per_kwh" && val !== "") {
      const price = parseFloat(val);
      if (!isNaN(price) && !isNaN(kwh) && kwh > 0) {
        next.total_cost = +(price * kwh).toFixed(2);
      }
    }
    if (key === "total_cost" && val !== "") {
      const cost = parseFloat(val);
      if (!isNaN(cost) && !isNaN(kwh) && kwh > 0) {
        next.price_per_kwh = +(cost / kwh).toFixed(4);
      }
    }
    // Recalcular custo total se kwh_added mudar e já houver preço/kWh
    if (key === "kwh_added" && next.price_per_kwh !== "") {
      const price = parseFloat(next.price_per_kwh);
      const newKwh = parseFloat(val);
      if (!isNaN(price) && !isNaN(newKwh) && newKwh > 0) {
        next.total_cost = +(price * newKwh).toFixed(2);
      }
    }
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateOdo(form.odometer);
    if (err) { setOdoError(err); return; }
    const payload = { ...form };
    delete payload._kwh_start_calc;
    ["duration_minutes","soc_start_pct","kwh_end","range_km","soc_end_pct","kwh_added","odometer","price_per_kwh","total_cost","car_avg_consumption"].forEach(k => {
      if (payload[k] !== "" && payload[k] != null) payload[k] = parseFloat(payload[k]);
      else delete payload[k];
    });

    // Guardar novo posto automaticamente na lista de locais
    if (customLocation && form.location_name?.trim()) {
      const alreadyExists = evLocations.some(l => l.name.toLowerCase() === form.location_name.trim().toLowerCase());
      if (!alreadyExists) {
        try { await base44.entities.Location.create({ name: form.location_name.trim(), type: "Eletricidade" }); } catch {}
      }
    }

    onSave(payload);
  };

  const vehicle = vehicles.find(v => v.id === form.vehicle_id);
  const batteryKwh = vehicle?.battery_capacity;

  // Calc % adicionada
  const pctAdded = form.soc_start_pct !== "" && form.soc_end_pct !== ""
    ? Math.max(0, parseFloat(form.soc_end_pct) - parseFloat(form.soc_start_pct)).toFixed(0)
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Veículo */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Veículo</Label>
        <select
          value={form.vehicle_id}
          onChange={e => set("vehicle_id", e.target.value)}
          className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
          required
        >
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>
          ))}
        </select>
        {batteryKwh && (
          <p className="text-[11px] text-muted-foreground">Bateria: {batteryKwh} kWh</p>
        )}
      </div>

      {/* Data e hora Início / Fim */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data e hora Início</Label>
          <Input type="datetime-local" value={form.start_datetime ?? ""} onChange={e => set("start_datetime", e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data e hora Fim</Label>
          <Input type="datetime-local" value={form.end_datetime ?? ""} onChange={e => set("end_datetime", e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      {/* Tempo carregamento */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Tempo carregamento (min)</Label>
        <Input type="number" value={form.duration_minutes ?? ""} onChange={e => set("duration_minutes", e.target.value)} placeholder="Auto-calculado" step="any" className="h-9 text-sm" />
      </div>

      {/* Percentagem início + KWh início + Autonomia início */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Início do carregamento</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Percentagem início (%)</Label>
            <Input type="number" value={form.soc_start_pct ?? ""} onChange={e => set("soc_start_pct", e.target.value)} placeholder="ex: 35" min={0} max={100} step="any" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">KWh início {batteryKwh ? "(auto)" : ""}</Label>
            <Input type="number" value={form.kwh_end ?? ""} onChange={e => set("kwh_end", e.target.value)} placeholder="ex: 13.5" step="any" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Autonomia início (km)</Label>
            <Input type="number" value={form.range_km ?? ""} onChange={e => set("range_km", e.target.value)} placeholder="ex: 28" step="any" className="h-9 text-sm" />
          </div>
        </div>
      </div>

      {/* Percentagem a carregar + KWh a carregar + Percentagem fim + KWh fim */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Energia carregada</p>
        {batteryKwh && pctAdded !== null && (
          <div className="grid grid-cols-2 gap-2 bg-muted/50 rounded-xl p-2 text-center text-xs mb-1">
            <div>
              <p className="text-muted-foreground text-[10px]">% Adicionada</p>
              <p className="font-bold text-green-600">{pctAdded}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px]">kWh Adicionados</p>
              <p className="font-bold text-green-600">{form.kwh_added !== "" ? form.kwh_added : "—"}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Percentagem fim (%)</Label>
            <Input type="number" value={form.soc_end_pct ?? ""} onChange={e => set("soc_end_pct", e.target.value)} placeholder="ex: 80" min={0} max={100} step="any" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">KWh a carregar {batteryKwh ? "(auto)" : ""}</Label>
            <Input type="number" value={form.kwh_added ?? ""} onChange={e => set("kwh_added", e.target.value)} placeholder="ex: 17.55" step="any" className="h-9 text-sm" />
          </div>
        </div>
      </div>

      {/* Local carregamento */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Local carregamento</Label>
          <select value={form.location_type} onChange={e => { set("location_type", e.target.value); set("location_name", ""); }} className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="Casa">🏠 Casa</option>
            <option value="Fora">⚡ Fora</option>
          </select>
        </div>
        {form.location_type === "Fora" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Posto / Marca</Label>
            {evLocations.length > 0 && !customLocation ? (
              <select
                value={form.location_name ?? ""}
                onChange={e => {
                  if (e.target.value === "__outro__") {
                    setCustomLocation(true);
                    set("location_name", "");
                  } else {
                    set("location_name", e.target.value);
                  }
                }}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">— Selecionar posto —</option>
                {evLocations.map(l => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
                <option value="__outro__">Outro...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <Input type="text" value={form.location_name ?? ""} onChange={e => set("location_name", e.target.value)} placeholder="Nome do posto..." className="h-9 text-sm flex-1" autoFocus />
                {evLocations.length > 0 && (
                  <button type="button" onClick={() => { setCustomLocation(false); set("location_name", ""); }} className="text-xs text-muted-foreground underline whitespace-nowrap">← lista</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Odómetro */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Odómetro (km){minOdometer ? ` — mínimo: ${minOdometer.toLocaleString("pt")} km` : ""}
        </Label>
        <Input
          type="number"
          value={form.odometer ?? ""}
          onChange={e => { set("odometer", e.target.value); setOdoError(validateOdo(e.target.value)); }}
          placeholder={minOdometer ? `${minOdometer}` : "km atual"}
          step="any"
          className={`h-9 text-sm ${odoError ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        {odoError && <p className="text-[11px] text-destructive font-medium">{odoError}</p>}
      </div>

      {/* Média do carro */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Média do carro (kWh/100km) <span className="font-normal">(opcional)</span></Label>
        <Input type="number" step="0.1" value={form.car_avg_consumption ?? ""} onChange={e => set("car_avg_consumption", e.target.value)} placeholder="ex: 15.2" className="h-9 text-sm" />
      </div>

      {/* Custo */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preço por kWh (€)</Label>
            <Input type="number" value={form.price_per_kwh ?? ""} onChange={e => set("price_per_kwh", e.target.value)} placeholder="ex: 0.16" step="any" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Custo Total (€)</Label>
            <Input type="number" value={form.total_cost ?? ""} onChange={e => set("total_cost", e.target.value)} placeholder="ex: 2.84" step="any" className="h-9 text-sm" />
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notas</Label>
        <Input type="text" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="Observações..." className="h-9 text-sm" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">Guardar</Button>
      </div>
    </form>
  );
}