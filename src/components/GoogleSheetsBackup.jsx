import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, RefreshCw, Save, Download } from "lucide-react";
import { toast } from "sonner";

const STRIP_KEYS = new Set(["id", "created_date", "updated_date", "created_by", "created_by_id", "_oldId"]);

const coerceValue = (val, key) => {
  if (val === null || val === undefined || val === "") return undefined;
  // Booleans stored as strings
  if (val === "true") return true;
  if (val === "false") return false;
  // Numeric fields
  const numKeys = ["year", "mileage", "tank_size", "fuel_range", "advertised_consumption",
    "advertised_consumption_electric", "battery_capacity", "electric_range", "battery_reserve_pct",
    "loan_amount", "last_maintenance_km", "amount", "mileage_at_expense", "liters", "price_per_unit",
    "tank_percentage", "car_avg_consumption", "duration_minutes", "soc_start_pct", "kwh_added",
    "soc_end_pct", "kwh_end", "range_km", "odometer", "price_per_kwh", "total_cost",
    "interval_km", "interval_months", "warning_km", "last_done_km", "installation_mileage",
    "cost", "next_replacement_km", "premium_amount"];
  if (numKeys.includes(key)) {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  return val;
};

const SHEET_FIELDS = [
  { key: "vehicles", label: "Veículos" },
  { key: "expenses", label: "Despesas" },
  { key: "loans", label: "Empréstimos" },
  { key: "chargings", label: "Carregamentos" },
  { key: "notifications", label: "Lembretes" },
  { key: "issuesOpen", label: "Avarias (ativas)" },
  { key: "issuesResolved", label: "Histórico (resolvidas)" },
  { key: "schedules", label: "Manutenções km" },
  { key: "parts", label: "Componentes" },
  { key: "documents", label: "Documentos" },
  { key: "insurances", label: "Seguros" },
  { key: "checklists", label: "Checklists" },
  { key: "locations", label: "Locais" },
];

const DEFAULT_NAMES = {
  vehicles: "Veículos",
  expenses: "Despesas",
  loans: "Empréstimos",
  chargings: "Carregamentos",
  notifications: "Lembretes",
  issuesOpen: "Avarias",
  issuesResolved: "Histórico",
  schedules: "Manutenções km",
  parts: "Componentes",
  documents: "Documentos",
  insurances: "Seguros",
  checklists: "Checklists",
  locations: "Locais",
};

export default function GoogleSheetsBackup({ onImported }) {
  const [url, setUrl] = useState("");
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [backing, setBacking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        if (user.sheets_backup_url) setUrl(user.sheets_backup_url);
        if (user.sheets_backup_names) setNames(prev => ({ ...prev, ...user.sheets_backup_names }));
      }
    }).catch(() => {});
  }, []);

  const extractId = (u) => {
    const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        sheets_backup_url: url,
        sheets_backup_names: names,
      });
      toast.success("Configuração guardada!");
    } catch (e) {
      toast.error("Erro ao guardar: " + e.message);
    }
    setSaving(false);
  };

  const handleImportFromSheets = async () => {
    const spreadsheetId = extractId(url);
    if (!spreadsheetId) {
      toast.error("Link inválido. Cola o link completo da spreadsheet.");
      return;
    }
    setImporting(true);
    try {
      await base44.auth.updateMe({
        sheets_backup_url: url,
        sheets_backup_names: names,
      });

      const res = await base44.functions.invoke("importFromGoogleSheets", {
        spreadsheet_id: spreadsheetId,
        sheets: names,
      });

      if (!res.data?.success) {
        toast.error("Erro: " + (res.data?.error || "desconhecido"));
        setImporting(false);
        return;
      }

      const all = res.data.data;
      const strip = (item) => {
        const cleaned = {};
        for (const [k, v] of Object.entries(item)) {
          if (STRIP_KEYS.has(k)) continue;
          const coerced = coerceValue(v, k);
          if (coerced !== undefined) cleaned[k] = coerced;
        }
        return cleaned;
      };

      let totalImported = 0;

      // 1. Import vehicles first and build old→new ID map
      const vehicleIdMap = {};
      if (all.Vehicle?.length) {
        for (const v of all.Vehicle) {
          const data = strip(v);
          const created = await base44.entities.Vehicle.create(data);
          if (v.id) vehicleIdMap[v.id] = created.id;
          totalImported++;
        }
      }

      // 2. Import entities with vehicle_id remapping
      const remapAndStrip = (arr) => (arr || []).map(item => {
        const cleaned = strip(item);
        if (cleaned.vehicle_id && vehicleIdMap[cleaned.vehicle_id]) {
          cleaned.vehicle_id = vehicleIdMap[cleaned.vehicle_id];
        }
        return cleaned;
      });

      const entityBatches = [
        { entity: "Expense", data: remapAndStrip(all.Expense) },
        { entity: "Charging", data: remapAndStrip(all.Charging) },
        { entity: "Notification", data: remapAndStrip(all.Notification) },
        { entity: "VehicleIssue", data: remapAndStrip(all.VehicleIssue) },
        { entity: "MaintenanceSchedule", data: remapAndStrip(all.MaintenanceSchedule) },
        { entity: "VehiclePart", data: remapAndStrip(all.VehiclePart) },
        { entity: "VehicleDocument", data: remapAndStrip(all.VehicleDocument) },
        { entity: "Insurance", data: remapAndStrip(all.Insurance) },
        { entity: "InspectionChecklist", data: remapAndStrip(all.InspectionChecklist) },
        { entity: "Location", data: (all.Location || []).map(strip) },
      ];

      for (const batch of entityBatches) {
        if (batch.data.length > 0) {
          await base44.entities[batch.entity].bulkCreate(batch.data);
          totalImported += batch.data.length;
        }
      }

      toast.success(`${totalImported} registos importados do Google Sheets!`);
      if (onImported) await onImported();
    } catch (e) {
      toast.error("Erro ao importar: " + e.message);
    }
    setImporting(false);
  };

  const handleBackup = async () => {
    const spreadsheetId = extractId(url);
    if (!spreadsheetId) {
      toast.error("Link inválido. Cola o link completo da spreadsheet.");
      return;
    }
    setBacking(true);
    setLastResult(null);
    try {
      await base44.auth.updateMe({
        sheets_backup_url: url,
        sheets_backup_names: names,
      });

      const res = await base44.functions.invoke("backupToGoogleSheets", {
        spreadsheet_id: spreadsheetId,
        sheets: names,
      });

      if (res.data?.success) {
        const results = res.data.results;
        let totalNew = 0;
        let errors = 0;
        results.forEach(r => {
          if (r.error) errors++;
          totalNew += r.new || 0;
        });
        setLastResult(results);
        if (errors > 0) {
          toast.warning(`Backup parcial: ${totalNew} registos sincronizados, ${errors} página(s) com erro.`);
        } else {
          toast.success(`Backup completo: ${totalNew} registos sincronizados!`);
        }
      } else {
        toast.error("Erro: " + (res.data?.error || "desconhecido"));
      }
    } catch (e) {
      toast.error("Erro: " + e.message);
    }
    setBacking(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-center">Backup Google Sheets</h2>
      <Card className="p-5 space-y-4 border-l-4 border-l-green-600 bg-green-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium">Sincronizar com Google Sheets</p>
            <p className="text-xs text-muted-foreground">Adiciona apenas novos registos à spreadsheet</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Link da Spreadsheet</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
          <p className="text-xs text-muted-foreground">Cola o link da spreadsheet partilhada contigo</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Página para cada tipo de registo</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHEET_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <Input
                  value={names[f.key]}
                  onChange={(e) => setNames(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={saveConfig} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "A guardar..." : "Guardar"}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleBackup} disabled={backing || !url}>
            <RefreshCw className={`w-3.5 h-3.5 ${backing ? "animate-spin" : ""}`} />
            {backing ? "A fazer backup..." : "Fazer Backup"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleImportFromSheets} disabled={importing || !url}>
            <Download className={`w-3.5 h-3.5 ${importing ? "animate-spin" : ""}`} />
            {importing ? "A importar..." : "Importar"}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Último resultado:</p>
            <div className="space-y-0.5">
              {lastResult.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{r.sheet}</span>
                  <span className={r.error ? "text-destructive" : "text-green-600 font-medium"}>
                    {r.error ? "erro" : r.status === "no_records" ? "sem dados" : `${r.total} sincronizados`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}