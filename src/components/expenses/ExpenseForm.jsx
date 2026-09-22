import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import ExpenseDetailsSection from "./ExpenseDetailsSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { saveCache, loadCache } from "@/lib/dataCache";
import ReceiptScanner from "./ReceiptScanner";
import ServiceItemsChecklist from "./ServiceItemsChecklist";
import { Wrench, ShieldCheck } from "lucide-react";

const DEFAULT_FUEL_STATIONS = [
  "Galp", "BP", "Repsol", "CEPSA/Moeve", "Prio Energy", "Intermarché", "E.Leclerc",
  "Jumbo", "Continente", "Pingo Doce", "Auchan", "Total Energies", "Shell"
];

const DEFAULT_MAINTENANCE_LOCATIONS = [
  "Oficina Própria", "Concessionário", "Casa"
];

const MAINTENANCE_SUBS = [
  "Revisão", "Pneus", "Estacionamento", "Multa", "Reparação de Peça",
  "Inspeção", "Lavagem", "Portagens", "IUC", "Outro"
];

const INSURANCE_SUBS = ["Seguro"];
const LOAN_SUBS = ["Crédito", "Leasing", "Renting", "Outro"];

const SERVICE_SUBS = ["Revisão"];

const MAINTENANCE_GROUPS = [
  { label: "Manutenção", subs: ["Reparação de Peça", "Pneus", "Inspeção", "Lavagem"] },
  { label: "Custos Fixos", subs: ["IUC"] },
  { label: "Despesas", subs: ["Estacionamento", "Multa", "Portagens"] },
];

// Map legacy/imported sub_category values to current ones
const SUB_CATEGORY_COMPAT = {
  "Gasóleo": "Gasóleo Simples",
  "Gasolina": "Gasolina 95",
  "Gasolina 98": "Gasolina Aditivada 98",
  "Elétrico": "Eletricidade",
};

function normalizeSubCategory(sub) {
  return SUB_CATEGORY_COMPAT[sub] || sub;
}

function getFuelSubs(fuelType, hybridChoice) {
  if (fuelType === "Gasóleo") return ["Gasóleo Simples", "Gasóleo Aditivado", "Biodiesel"];
  if (fuelType === "Gasolina") return ["Gasolina 95", "Gasolina Aditivada 98"];
  if (fuelType === "Elétrico") return ["Eletricidade"];
  if (fuelType === "Híbrido") {
    if (hybridChoice === "Gasolina") return ["Gasolina 95", "Gasolina Aditivada 98"];
    if (hybridChoice === "Eletricidade") return ["Eletricidade"];
    return [];
  }
  if (fuelType === "Híbrido EREV") {
    if (hybridChoice === "Gasolina") return ["Gasolina 95", "Gasolina Aditivada 98"];
    if (hybridChoice === "Eletricidade") return ["Eletricidade"];
    return [];
  }
  if (fuelType === "GPL") return ["GPL"];
  return ["Gasóleo Simples", "Gasóleo Aditivado", "Biodiesel", "Gasolina 95", "Gasolina Aditivada 98", "Eletricidade", "GPL"];
}

// A select that shows custom locations + defaults, plus a free-text fallback
function LocationSelect({ value, onChange, defaults, custom, placeholder, onNewLocation, locationType }) {
  const [freeText, setFreeText] = useState(false);
  const [draft, setDraft] = useState("");
  const allOptions = [
    ...custom.map(l => l.name),
    ...defaults.filter(d => !custom.find(c => c.name === d)),
  ];
  const isCustomValue = value && !allOptions.includes(value);

  const confirmFreeText = () => {
    if (!draft.trim()) return;
    onChange(draft.trim());
    if (onNewLocation) onNewLocation(draft.trim(), locationType || "Geral");
    setFreeText(false);
    setDraft("");
  };

  if (freeText || isCustomValue) {
    return (
      <div className="flex gap-2">
        <Input
          value={isCustomValue && !freeText ? value : draft}
          onChange={e => { setDraft(e.target.value); if (!freeText) setFreeText(true); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmFreeText(); } }}
          placeholder="Escrever local..."
          className="flex-1"
          autoFocus={freeText && !isCustomValue}
        />
        {freeText && draft.trim() && (
          <Button type="button" size="sm" className="shrink-0 text-xs" onClick={confirmFreeText}>
            Guardar
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => { onChange(""); setFreeText(false); setDraft(""); }}>
          Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">{placeholder}</option>
        {custom.length > 0 && (
          <optgroup label="Os meus locais">
            {custom.map(l => <option key={`c-${l.name}`} value={l.name}>⭐ {l.name}</option>)}
          </optgroup>
        )}
        <optgroup label={custom.length > 0 ? "Outros" : "Locais"}>
          {defaults.filter(d => !custom.find(c => c.name === d)).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </optgroup>
      </select>
      <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setFreeText(true)}>
        Outro
      </Button>
    </div>
  );
}

export default function ExpenseForm({ expense, vehicles, allExpenses = [], onSave, onCancel, defaultCategory, defaultSubCategory, serviceMode }) {
  const isEditing = !!expense;
  // Se editando um registo com sub_category personalizada (não está na lista de MAINTENANCE_SUBS)
  const isCustomSub = expense?.sub_category && !MAINTENANCE_SUBS.includes(expense.sub_category) && !["Combustível", "Seguros", "Empréstimos"].includes(expense.category);

  // Find last fuel expense for a given vehicle to pre-fill fields
  const getLastFuelExpense = (vehicleId) => {
    if (!vehicleId || isEditing) return null;
    return allExpenses
      .filter(e => e.vehicle_id === vehicleId && e.category === "Combustível")
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
  };

  const buildInitialForm = (vehicleId) => {
    const last = getLastFuelExpense(vehicleId);
    const isCombustion = vehicles.find(v => v.id === vehicleId)?.fuel_type !== "Elétrico";
    // When a defaultCategory is explicitly set (from FAB menu), don't inherit
    // fuel data from the last expense — only pre-fill for the "Combustível" path.
    const useFuelDefaults = !expense && !defaultCategory && last && isCombustion;
    const isFuelCategory = expense?.category === "Combustível" || defaultCategory === "Combustível";
    return {
      vehicle_id: vehicleId || "",
      category: expense?.category || defaultCategory || (useFuelDefaults ? "Combustível" : ""),
      sub_category: isCustomSub ? "Outro" : normalizeSubCategory(expense?.sub_category || defaultSubCategory || (defaultCategory === "Seguros" ? "Seguro" : "") || (isFuelCategory && last ? last.sub_category : "") || ""),
      amount: expense?.amount || "",
      date: expense?.date || new Date().toISOString().split("T")[0],
      mileage_at_expense: expense?.mileage_at_expense || "",
      liters: expense?.liters || "",
      price_per_unit: expense?.price_per_unit || (isFuelCategory && last ? last.price_per_unit || "" : ""),
      location: expense?.location || (isFuelCategory && last ? last.location || "" : ""),
      description: expense?.description || "",
      car_avg_consumption: expense?.car_avg_consumption || "",
      tank_percentage: expense?.tank_percentage || (expense?.full_tank === false ? "" : 100),
    };
  };

  const [form, setForm] = useState(() => buildInitialForm(expense?.vehicle_id || ""));
  const [maintenanceType, setMaintenanceType] = useState(expense?.maintenance_type || "Corretiva");

  const initialHybridChoice = expense?.sub_category === "Eletricidade" ? "Eletricidade" : "Gasolina";
  const [hybridChoice, setHybridChoice] = useState(initialHybridChoice);
  const [fullTank, setFullTank] = useState(expense?.full_tank !== false ? true : false);
  const [parts, setParts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  const [customMaintenanceSubs, setCustomMaintenanceSubs] = useState([]);
  const [kmError, setKmError] = useState(null);
  const [outroDescription, setOutroDescription] = useState(isCustomSub ? expense.sub_category : "");
  // Track which field was last changed by user to know what to auto-calculate
  const lastChanged = useRef(null);

  useEffect(() => {
    const apply = (locs) => {
      setCustomLocations(locs.filter(l => l.type !== "Manutenção Personalizada"));
      setCustomMaintenanceSubs(
        locs.filter(l => l.type === "Manutenção Personalizada")
            .map(l => l.name)
            .sort((a, b) => a.localeCompare(b))
      );
    };

    base44.entities.Location.list("name")
      .then((locs) => {
        saveCache("locations", locs);
        apply(locs);
      })
      .catch(() => {
        // Sem rede: usa a última lista guardada em cache.
        apply(loadCache("locations") || []);
      });
  }, []);

  const handleDetailsChange = (key, val) => {
    if (key === "parts") setParts(val);
    else setDocs(val);
  };

  const handleNewLocation = (name, type) => {
    const alreadyExists = customLocations.find(l => l.name === name);
    if (alreadyExists) return;
    // Add optimistically to state immediately so it shows in the list right away
    const optimistic = { id: `temp-${Date.now()}`, name, type };
    setCustomLocations(prev => [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)));
    base44.entities.Location.create({ name, type }).then(created => {
      setCustomLocations(prev => prev.map(l => l.id === optimistic.id ? created : l));
    }).catch(() => {});
  };

  const selectedVehicle = vehicles.find(v => v.id === form.vehicle_id);
  const vehicleNotFound = isEditing && form.vehicle_id && !selectedVehicle;
  const fuelType = selectedVehicle?.fuel_type || "";
  const isElectric = fuelType === "Elétrico" || ((fuelType === "Híbrido" || fuelType === "Híbrido EREV") && hybridChoice === "Eletricidade") || (fuelType === "Híbrido EREV" && form.sub_category === "Eletricidade");
  const isFuel = form.category === "Combustível";
  // When no vehicle is matched, derive fuelSubs from the saved sub_category so it still shows
  const fuelSubs = fuelType
    ? getFuelSubs(fuelType, hybridChoice)
    : form.sub_category ? [form.sub_category] : getFuelSubs("", hybridChoice);

  // Auto-select subcategory when only one option (skip on first render if editing)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isFuel && fuelSubs.length === 1) {
      setForm(f => ({ ...f, sub_category: fuelSubs[0] }));
    } else if (isFuel && fuelSubs.length > 0 && !fuelSubs.includes(form.sub_category)) {
      setForm(f => ({ ...f, sub_category: "" }));
    }
  }, [fuelType, hybridChoice, form.category]);

  // Auto-calculate the missing field based on which two are filled
  useEffect(() => {
    const liters = Number(form.liters);
    const amount = Number(form.amount);
    const ppu = Number(form.price_per_unit);
    const changed = lastChanged.current;

    if (changed === "liters" || changed === "amount") {
      // User changed liters or total → calculate price per unit
      if (liters > 0 && amount > 0) {
        setForm(f => ({ ...f, price_per_unit: (amount / liters).toFixed(3) }));
      }
    } else if (changed === "price_per_unit") {
      // User changed price per unit → calculate total if liters known, or liters if total known
      if (ppu > 0 && liters > 0) {
        setForm(f => ({ ...f, amount: (ppu * liters).toFixed(2) }));
      } else if (ppu > 0 && amount > 0) {
        setForm(f => ({ ...f, liters: (amount / ppu).toFixed(2) }));
      }
    }
  }, [form.liters, form.amount, form.price_per_unit]);

  // Validate km against neighbouring records for the same vehicle
  const validateKm = (km, date) => {
    if (!km || !form.vehicle_id) return null;
    const kmNum = Number(km);
    const dateStr = date || form.date;

    // All fuel+maintenance records for this vehicle with km, excluding current record
    // Sort by odometer — the ground truth for sequence, not date
    const siblings = allExpenses
      .filter(e => e.vehicle_id === form.vehicle_id && e.mileage_at_expense && e.id !== expense?.id)
      .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

    if (siblings.length === 0) return null;

    // Find the record immediately before and after by odometer
    const before = [...siblings].filter(e => e.mileage_at_expense < kmNum).sort((a, b) => b.mileage_at_expense - a.mileage_at_expense)[0];
    const after  = [...siblings].filter(e => e.mileage_at_expense > kmNum).sort((a, b) => a.mileage_at_expense - b.mileage_at_expense)[0];

    if (before && kmNum < before.mileage_at_expense) {
      return `O odómetro inserido (${kmNum.toLocaleString()} km) é inferior ao registo anterior (${before.mileage_at_expense.toLocaleString()} km em ${new Date(before.date + "T12:00:00").toLocaleDateString("pt-PT")}). Corrige o valor.`;
    }
    if (after && kmNum > after.mileage_at_expense) {
      return `O odómetro inserido (${kmNum.toLocaleString()} km) é superior ao registo seguinte (${after.mileage_at_expense.toLocaleString()} km em ${new Date(after.date + "T12:00:00").toLocaleDateString("pt-PT")}). Corrige o valor.`;
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Block submit if km error exists (for fuel entries where km is required)
    if (isFuel) {
      if (!form.mileage_at_expense) {
        setKmError("A quilometragem é obrigatória para registos de combustível.");
        return;
      }
      const err = validateKm(form.mileage_at_expense, form.date);
      if (err) { setKmError(err); return; }
      if (!form.location) {
        alert("Por favor indica o local / posto de abastecimento.");
        return;
      }
    }

    // Se manutenção "Outro", guarda o valor personalizado para uso futuro
    const finalSubCategory = (!isFuel && form.sub_category === "Outro" && outroDescription)
      ? outroDescription
      : form.sub_category;

    if (!isFuel && form.sub_category === "Outro" && outroDescription) {
      const alreadyExists = customMaintenanceSubs.includes(outroDescription);
      if (!alreadyExists) {
        base44.entities.Location.create({ name: outroDescription, type: "Manutenção Personalizada" }).catch(() => {});
      }
    }

    onSave({
      ...form,
      sub_category: finalSubCategory,
      maintenance_type: serviceMode ? maintenanceType : undefined,
      amount: Number(form.amount),
      mileage_at_expense: form.mileage_at_expense ? Number(form.mileage_at_expense) : undefined,
      liters: form.liters ? Number(form.liters) : undefined,
      price_per_unit: isFuel && form.price_per_unit ? Number(form.price_per_unit) : undefined,
      full_tank: isFuel ? fullTank : undefined,
      tank_percentage: isFuel && !fullTank && form.tank_percentage ? Number(form.tank_percentage) : undefined,
      car_avg_consumption: form.car_avg_consumption ? Number(form.car_avg_consumption) : undefined,
      _parts: parts,
      _docs: docs,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Receipt Scanner — always shown at top */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Ler talão com IA (opcional)</Label>
        <ReceiptScanner
          isElectric={isElectric}
          isFuel={isFuel}
          onExtracted={(data) => {
            lastChanged.current = null;
            setForm(f => ({
              ...f,
              amount: data.amount !== undefined && data.amount !== null ? data.amount : f.amount,
              liters: data.liters !== undefined && data.liters !== null ? data.liters : f.liters,
              price_per_unit: data.price_per_unit !== undefined && data.price_per_unit !== null ? data.price_per_unit : f.price_per_unit,
              location: data.location || f.location,
              date: data.date || f.date,
              description: data.description || f.description,
            }));
          }}
        />
      </div>

      {/* Vehicle */}
      <div className="space-y-2">
        <Label>Veículo *</Label>
        <Select value={vehicleNotFound ? "" : form.vehicle_id} onValueChange={(v) => {
          const newBase = buildInitialForm(v);
          setForm({ ...newBase, date: form.date });
        }}>
          <SelectTrigger className={vehicleNotFound ? "border-amber-400 text-amber-700" : ""}>
            <SelectValue placeholder={vehicleNotFound ? "⚠️ Veículo não encontrado — re-selecionar" : "Selecionar veículo"} />
          </SelectTrigger>
          <SelectContent>
            {(defaultCategory === "Empréstimos" ? vehicles.filter(v => v.loan_amount > 0) : vehicles).map(v => (
              <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} ({v.license_plate})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vehicleNotFound && (
          <p className="text-xs text-amber-600">Este registo foi importado com um veículo diferente. Por favor seleciona o veículo correto.</p>
        )}
      </div>

      {/* Category — always shown when editing, hidden when creating with a defaultCategory */}
      {(isEditing || !defaultCategory) && (
        <div className="space-y-2">
          <Label>Categoria *</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, sub_category: v === "Seguros" ? "Seguro" : "" })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Combustível">Combustível</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Seguros">Seguros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Híbrido choice */}
      {isFuel && (fuelType === "Híbrido" || fuelType === "Híbrido EREV") && (
        <div className="space-y-2">
          <Label>Tipo de Abastecimento</Label>
          <div className="flex gap-2">
            {["Gasolina", "Eletricidade"].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setHybridChoice(opt); setForm(f => ({ ...f, sub_category: "" })); }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  hybridChoice === opt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subcategory */}
      {form.category && (
        <div className="space-y-2">
          <Label>Subcategoria *</Label>
          {isFuel && fuelSubs.length === 1 ? (
            <div className="px-3 py-2 rounded-xl bg-muted text-sm font-medium">{fuelSubs[0]}</div>
          ) : form.category === "Seguros" ? (
            <div className="px-3 py-2 rounded-xl bg-muted text-sm font-medium">Seguro</div>
          ) : (defaultCategory === "Empréstimos" && !isEditing) ? (
            <div className="px-3 py-2 rounded-xl bg-muted text-sm font-medium">Crédito</div>
          ) : (
            <Select value={form.sub_category} onValueChange={(v) => { setForm({ ...form, sub_category: v }); if (v !== "Outro") setOutroDescription(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {isFuel
                  ? fuelSubs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)
                  : form.category === "Empréstimos"
                  ? LOAN_SUBS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)
                  : serviceMode
                  ? (
                      <>
                        {SERVICE_SUBS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </>
                    )
                    : (
                      <>
                        {MAINTENANCE_GROUPS.map(group => (
                          <SelectGroup key={group.label}>
                            <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</SelectLabel>
                            {group.subs.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                        {customMaintenanceSubs.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Personalizados</SelectLabel>
                            {customMaintenanceSubs.map(s => (
                              <SelectItem key={`custom-${s}`} value={s}>⭐ {s}</SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        <SelectItem value="Outro">Outro...</SelectItem>
                      </>
                    )
                }
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Maintenance type toggle — only in service mode */}
      {serviceMode && (
        <div className="space-y-2">
          <Label>Tipo de Manutenção</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMaintenanceType("Corretiva")}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                maintenanceType === "Corretiva" ? "bg-red-100 text-red-700 border-red-300" : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Corretiva
            </button>
            <button
              type="button"
              onClick={() => setMaintenanceType("Preventiva")}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                maintenanceType === "Preventiva" ? "bg-green-100 text-green-700 border-green-300" : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Preventiva
            </button>
          </div>
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label>Data *</Label>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => {
            setForm({ ...form, date: e.target.value });
            if (form.mileage_at_expense) setKmError(validateKm(form.mileage_at_expense, e.target.value));
          }}
          required
        />
      </div>

      {/* Fuel-specific fields */}
      {isFuel && (
        <>
          {/* Mileage */}
          <div className="space-y-2">
            <Label>Quilometragem (km) *</Label>
            <Input
              type="number"
              value={form.mileage_at_expense}
              onChange={(e) => {
                setForm({ ...form, mileage_at_expense: e.target.value });
                setKmError(validateKm(e.target.value, form.date));
              }}
              placeholder="km atual"
              className={kmError ? "border-amber-400 focus-visible:ring-amber-400" : ""}
              required
            />
            {kmError && <p className="text-xs text-amber-600 font-medium">{kmError}</p>}
          </div>

          {/* Price / Total / Liters row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Preço L/kWh</Label>
              <Input type="number" step="0.001" value={form.price_per_unit}
                onChange={(e) => { lastChanged.current = "price_per_unit"; setForm({ ...form, price_per_unit: e.target.value }); }}
                placeholder="0.000" />
            </div>
            <div className="space-y-2">
              <Label>Valor total (€)</Label>
              <Input type="number" step="0.01" value={form.amount}
                onChange={(e) => { lastChanged.current = "amount"; setForm({ ...form, amount: e.target.value }); }}
                required placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Litros/kWh</Label>
              <Input type="number" step="0.01" value={form.liters}
                onChange={(e) => { lastChanged.current = "liters"; setForm({ ...form, liters: e.target.value }); }}
                placeholder={isElectric ? "kWh" : "L"} />
            </div>
          </div>

          {/* Full tank toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <Label className="cursor-pointer">Depósito cheio?</Label>
            <Switch checked={fullTank} onCheckedChange={(v) => {
              setFullTank(v);
              setForm(f => ({ ...f, tank_percentage: v ? 100 : "" }));
            }} />
          </div>

          {/* Tank percentage — only for partial refuels of fossil-fuel vehicles */}
          {!fullTank && !isElectric && (
            <div className="space-y-2">
              <Label>% do depósito abastecido <span className="text-muted-foreground font-normal">(litros = % × depósito)</span></Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.tank_percentage || ""}
                onChange={(e) => setForm({ ...form, tank_percentage: e.target.value })}
                placeholder="ex: 75"
              />
              {selectedVehicle?.tank_size && form.tank_percentage && (
                <p className="text-xs text-muted-foreground">
                  ≈ {(Number(form.tank_percentage) * selectedVehicle.tank_size / 100).toFixed(1)} L abastecidos de {selectedVehicle.tank_size}L
                </p>
              )}
            </div>
          )}

          {/* Car computer average */}
          <div className="space-y-2">
            <Label>{isElectric ? "Média do carro (kWh/100km)" : "Média do carro (L/100km)"} <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              type="number"
              step="0.1"
              value={form.car_avg_consumption}
              onChange={(e) => setForm({ ...form, car_avg_consumption: e.target.value })}
              placeholder={isElectric ? "ex: 15.2" : "ex: 6.6"}
            />
          </div>

          {/* Fuel Station */}
          <div className="space-y-2">
            <Label>Local / Posto de Combustível *</Label>
            <LocationSelect
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
              defaults={DEFAULT_FUEL_STATIONS}
              custom={customLocations.filter(l => l.type === (isElectric ? "Eletricidade" : "Combustível") || l.type === "Geral")}
              placeholder="Selecionar local"
              onNewLocation={handleNewLocation}
              locationType={isElectric ? "Eletricidade" : "Combustível"}
            />
          </div>
        </>
      )}

      {/* Total for maintenance only */}
      {!isFuel && (
        <div className="space-y-2">
          <Label>Valor Total (€) *</Label>
          <Input type="number" step="0.01" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required placeholder="0.00" />
        </div>
      )}

      {/* Loan balance info */}
      {form.category === "Empréstimos" && form.vehicle_id && selectedVehicle?.loan_amount > 0 && (() => {
        const totalLoan = Number(selectedVehicle.loan_amount);
        const paidSoFar = allExpenses
          .filter(e => e.vehicle_id === form.vehicle_id && e.category === "Empréstimos" && e.id !== expense?.id)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const currentPayment = Number(form.amount) || 0;
        const remaining = totalLoan - paidSoFar - currentPayment;
        const pctPaid = totalLoan > 0 ? Math.min(100, ((paidSoFar + currentPayment) / totalLoan) * 100) : 0;
        return (
          <div className="rounded-xl border border-pink-200 bg-pink-50/70 dark:bg-pink-950/30 dark:border-pink-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-pink-700 dark:text-pink-400">Empréstimo do Veículo</span>
              <span className="text-muted-foreground">Total: {totalLoan.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Já pago</span>
              <span className="font-semibold">{paidSoFar.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
            </div>
            {currentPayment > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Este pagamento</span>
                <span className="font-semibold text-primary">{currentPayment.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-1 border-t border-pink-200 dark:border-pink-900/50">
              <span className="font-bold">Falta pagar</span>
              <span className={`font-bold ${remaining <= 0 ? "text-green-600" : "text-pink-700 dark:text-pink-400"}`}>
                {remaining.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-pink-100 dark:bg-pink-950/50 overflow-hidden">
              <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${pctPaid}%` }} />
            </div>
            {remaining <= 0 && (
              <p className="text-xs text-green-600 font-medium">✓ Empréstimo liquidado!</p>
            )}
          </div>
        );
      })()}

      {/* Mileage for maintenance */}
      {!isFuel && (
        <div className="space-y-2">
          <Label>Quilometragem (km)</Label>
          <Input type="number" value={form.mileage_at_expense}
            onChange={(e) => setForm({ ...form, mileage_at_expense: e.target.value })}
            placeholder="km atual" />
        </div>
      )}

      {/* Descrição obrigatória para "Outro" em manutenção */}
      {!isFuel && form.sub_category === "Outro" && (
        <div className="space-y-2">
          <Label>Descrição *</Label>
          <Input
            value={outroDescription}
            onChange={(e) => { setOutroDescription(e.target.value); setForm(f => ({ ...f, description: e.target.value })); }}
            placeholder="Ex: Troca de correia de distribuição"
            required
          />
        </div>
      )}

      {/* Location for maintenance */}
      {!isFuel && (
        <div className="space-y-2">
          <Label>Local / Oficina</Label>
          <LocationSelect
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
            defaults={DEFAULT_MAINTENANCE_LOCATIONS}
            custom={customLocations.filter(l => l.type === "Manutenção" || l.type === "Geral")}
            placeholder="Selecionar ou escrever local"
            onNewLocation={handleNewLocation}
            locationType="Manutenção"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notas adicionais" />
      </div>

      {/* Service items checklist — only in service mode */}
      {serviceMode && (
        <ServiceItemsChecklist parts={parts} docs={docs} onChange={handleDetailsChange} expenseDefaults={{ date: form.date, amount: form.amount, location: form.location, sub_category: form.sub_category, mileage_at_expense: form.mileage_at_expense }} />
      )}

      <ExpenseDetailsSection parts={parts} docs={docs} onChange={handleDetailsChange} expenseDefaults={{ date: form.date, amount: form.amount, location: form.location, sub_category: form.sub_category }} />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1">{expense ? "Guardar" : "Registar"}</Button>
      </div>
    </form>
  );
}