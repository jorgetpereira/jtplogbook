import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { ArrowDownUp, Download, Upload, FileJson, FileSpreadsheet, Archive, FileDown } from "lucide-react";
import { exportToXLSX, exportFullReportXLSX } from "@/lib/reportExporter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import JSZip from "jszip";
import GoogleSheetsBackup from "@/components/GoogleSheetsBackup";

const TEMPLATES = {
  Vehicle: {
    filename: "modelo-veiculos.xlsx",
    sheetName: "Veículos",
    fields: ["brand", "model", "year", "license_plate", "registration_date", "fuel_type", "color", "mileage", "tank_size", "fuel_range", "advertised_consumption", "advertised_consumption_electric", "battery_capacity", "electric_range", "battery_reserve_pct", "loan_amount", "image_url", "notes", "last_maintenance_date", "last_maintenance_km", "is_active"],
    example: { brand: "Toyota", model: "Corolla", year: 2020, license_plate: "00-AB-00", registration_date: "2020-01-15", fuel_type: "Gasolina", color: "Branco", mileage: 50000, tank_size: 50, fuel_range: 600, advertised_consumption: 5.5, loan_amount: 25000, is_active: "true" },
  },
  Expense: {
    filename: "modelo-despesas.xlsx",
    sheetName: "Despesas",
    fields: ["vehicle_id", "license_plate", "category", "sub_category", "amount", "date", "mileage_at_expense", "liters", "price_per_unit", "full_tank", "tank_percentage", "car_avg_consumption", "location", "description", "receipt_url", "maintenance_type"],
    example: { vehicle_id: "(ou deixar vazio)", license_plate: "00-AB-00", category: "Combustível", sub_category: "Gasolina", amount: 50.0, date: "2024-01-15", mileage_at_expense: 50000, liters: 40, price_per_unit: 1.5, full_tank: "true", location: "Galp", maintenance_type: "Corretiva" },
  },
  Charging: {
    filename: "modelo-carregamentos.xlsx",
    sheetName: "Carregamentos",
    fields: ["vehicle_id", "license_plate", "start_datetime", "end_datetime", "duration_minutes", "soc_start_pct", "kwh_added", "soc_end_pct", "kwh_end", "range_km", "location_type", "location_name", "odometer", "price_per_kwh", "total_cost", "car_avg_consumption", "notes"],
    example: { vehicle_id: "(ou deixar vazio)", license_plate: "00-AB-00", start_datetime: "2024-01-15T22:00:00", end_datetime: "2024-01-16T06:00:00", duration_minutes: 480, soc_start_pct: 20, kwh_added: 30, soc_end_pct: 80, range_km: 300, location_type: "Casa", location_name: "Garagem", odometer: 50000, price_per_kwh: 0.15, total_cost: 4.5, notes: "Carregamento noturno" },
  },
};

const downloadTemplate = (tpl) => {
  const ws = XLSX.utils.json_to_sheet([tpl.example], { header: tpl.fields });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);
  XLSX.writeFile(wb, tpl.filename);
};

const parseExcel = async (file) => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
};

export default function ImportExport() {
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [parts, setParts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [chargings, setChargings] = useState([]);
  const [issues, setIssues] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [v, e, p, d, n, c, i, s, ins, cl, loc] = await Promise.all([
        base44.entities.Vehicle.list(),
        base44.entities.Expense.list("-date", 1000),
        base44.entities.VehiclePart.list(),
        base44.entities.VehicleDocument.list(),
        base44.entities.Notification.list(),
        base44.entities.Charging.list("-start_datetime", 1000),
        base44.entities.VehicleIssue.list("-created_date", 1000),
        base44.entities.MaintenanceSchedule.list("-created_date", 1000),
        base44.entities.Insurance.list("-created_date", 1000),
        base44.entities.InspectionChecklist.list("-created_date", 1000),
        base44.entities.Location.list("name", 1000),
      ]);
      setVehicles(v);
      setExpenses(e);
      setParts(p);
      setDocs(d);
      setNotifications(n);
      setChargings(c);
      setIssues(i);
      setSchedules(s);
      setInsurances(ins);
      setChecklists(cl);
      setLocations(loc);
      setLoading(false);
    }
    load();
  }, []);

  const triggerDownload = (blob, filename) => {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      
      // Use requestAnimationFrame para garantir que o elemento está no DOM antes de clicar
      requestAnimationFrame(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      });
    } catch (err) {
      toast.error("Erro ao descarregar ficheiro: " + err.message);
    }
  };

  const exportJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(blob, filename);
    toast.success("Ficheiro exportado com sucesso!");
  };

  const exportXLSX = (data, filename, sheetName) => {
    if (data.length === 0) { toast.error("Sem dados para exportar"); return; }
    exportToXLSX(data, filename, sheetName);
    toast.success("Ficheiro Excel exportado com sucesso!");
  };

  const exportAllJSON = () => {
    const all = { vehicles, expenses, parts, docs, notifications, chargings, issues, schedules, insurances, checklists, locations };
    exportJSON(all, `logbook-completo-${new Date().toISOString().split("T")[0]}.json`);
  };

  const exportAllZIP = async () => {
    const zip = new JSZip();
    const date = new Date().toISOString().split("T")[0];
    zip.file("veiculos.json", JSON.stringify(vehicles, null, 2));
    zip.file("despesas.json", JSON.stringify(expenses, null, 2));
    zip.file("pecas.json", JSON.stringify(parts, null, 2));
    zip.file("documentos.json", JSON.stringify(docs, null, 2));
    zip.file("lembretes.json", JSON.stringify(notifications, null, 2));
    zip.file("carregamentos.json", JSON.stringify(chargings, null, 2));
    zip.file("avarias.json", JSON.stringify(issues, null, 2));
    zip.file("manutencoes_km.json", JSON.stringify(schedules, null, 2));
    zip.file("seguros.json", JSON.stringify(insurances, null, 2));
    zip.file("checklists.json", JSON.stringify(checklists, null, 2));
    zip.file("locais.json", JSON.stringify(locations, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `logbook-backup-${date}.zip`);
    toast.success("ZIP exportado com sucesso!");
  };

  const handleImportAll = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const all = JSON.parse(text);
    const strip = ({ id, created_date, updated_date, created_by, ...rest }) => ({ _oldId: id, ...rest });

    // 1. Import vehicles first and build old→new ID map (skip duplicates by license_plate)
    const vehicleIdMap = {};
    const existingPlates = new Set(vehicles.map(v => (v.license_plate || "").toLowerCase().trim()));
    let vehicleSkipped = 0;
    if (all.vehicles?.length) {
      const oldVehicles = all.vehicles.map(strip);
      for (const v of oldVehicles) {
        const { _oldId, ...data } = v;
        const plate = (data.license_plate || "").toLowerCase().trim();
        if (plate && existingPlates.has(plate)) {
          // Link to existing vehicle instead of duplicating
          const existing = vehicles.find(ev => (ev.license_plate || "").toLowerCase().trim() === plate);
          if (_oldId && existing) vehicleIdMap[_oldId] = existing.id;
          vehicleSkipped++;
          continue;
        }
        const created = await base44.entities.Vehicle.create(data);
        if (_oldId) vehicleIdMap[_oldId] = created.id;
      }
    }

    // 2. Import expenses/charging/parts/docs with corrected vehicle_id
    const remapVehicle = (arr) => (arr || []).map(({ id, created_date, updated_date, created_by, ...rest }) => ({
      ...rest,
      vehicle_id: vehicleIdMap[rest.vehicle_id] || rest.vehicle_id,
    }));

    const remapNotif = (arr) => (arr || []).map(({ id, created_date, updated_date, created_by, ...rest }) => ({
      ...rest,
      vehicle_id: vehicleIdMap[rest.vehicle_id] || rest.vehicle_id,
    }));

    await Promise.all([
      all.expenses?.length ? base44.entities.Expense.bulkCreate(remapVehicle(all.expenses)) : Promise.resolve(),
      all.chargings?.length ? base44.entities.Charging.bulkCreate(remapVehicle(all.chargings)) : Promise.resolve(),
      all.parts?.length ? base44.entities.VehiclePart.bulkCreate(remapVehicle(all.parts)) : Promise.resolve(),
      all.docs?.length ? base44.entities.VehicleDocument.bulkCreate(remapVehicle(all.docs)) : Promise.resolve(),
      all.notifications?.length ? base44.entities.Notification.bulkCreate(remapNotif(all.notifications)) : Promise.resolve(),
      all.issues?.length ? base44.entities.VehicleIssue.bulkCreate(remapVehicle(all.issues)) : Promise.resolve(),
      all.schedules?.length ? base44.entities.MaintenanceSchedule.bulkCreate(remapVehicle(all.schedules)) : Promise.resolve(),
      all.insurances?.length ? base44.entities.Insurance.bulkCreate(remapVehicle(all.insurances)) : Promise.resolve(),
      all.checklists?.length ? base44.entities.InspectionChecklist.bulkCreate(remapVehicle(all.checklists)) : Promise.resolve(),
      all.locations?.length ? base44.entities.Location.bulkCreate(all.locations.map(({ id, created_date, updated_date, created_by, ...rest }) => rest)) : Promise.resolve(),
    ]);

    toast.success(`Backup importado!${vehicleSkipped > 0 ? ` ${vehicleSkipped} veículo(s) duplicado(s) ignorado(s).` : ""}`);
    const [v, ex, c, p, d, n, i, s, ins, cl, loc] = await Promise.all([
      base44.entities.Vehicle.list(),
      base44.entities.Expense.list("-date", 1000),
      base44.entities.Charging.list("-start_datetime", 1000),
      base44.entities.VehiclePart.list(),
      base44.entities.VehicleDocument.list(),
      base44.entities.Notification.list(),
      base44.entities.VehicleIssue.list("-created_date", 1000),
      base44.entities.MaintenanceSchedule.list("-created_date", 1000),
      base44.entities.Insurance.list("-created_date", 1000),
      base44.entities.InspectionChecklist.list("-created_date", 1000),
      base44.entities.Location.list("name", 1000),
    ]);
    setVehicles(v); setExpenses(ex); setChargings(c); setParts(p); setDocs(d); setNotifications(n);
    setIssues(i); setSchedules(s); setInsurances(ins); setChecklists(cl); setLocations(loc);
    setImporting(false);
    e.target.value = "";
  };

  const NUM_FIELDS = {
    Vehicle: ["year", "mileage", "tank_size", "fuel_range", "advertised_consumption", "advertised_consumption_electric", "battery_capacity", "electric_range", "battery_reserve_pct", "loan_amount", "last_maintenance_km"],
    Expense: ["amount", "mileage_at_expense", "liters", "price_per_unit", "tank_percentage", "car_avg_consumption"],
    Charging: ["duration_minutes", "soc_start_pct", "kwh_added", "soc_end_pct", "kwh_end", "range_km", "odometer", "price_per_kwh", "total_cost", "car_avg_consumption"],
  };
  const BOOL_FIELDS = { Vehicle: ["is_active"], Expense: ["full_tank"] };

  const coerceItem = (item, entityType) => {
    const out = { ...item };
    (NUM_FIELDS[entityType] || []).forEach(k => {
      if (out[k] !== undefined && out[k] !== "") {
        const n = Number(out[k]);
        out[k] = isNaN(n) ? out[k] : n;
      }
    });
    (BOOL_FIELDS[entityType] || []).forEach(k => {
      if (out[k] === "true" || out[k] === 1) out[k] = true;
      if (out[k] === "false" || out[k] === 0) out[k] = false;
    });
    return out;
  };

  const handleImport = async (e, entityType) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      let data;
      if (file.name.endsWith(".json")) {
        data = JSON.parse(await file.text());
      } else if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.trim());
        data = lines.slice(1).map(line => {
          const values = line.split(",");
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ""; });
          return obj;
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        data = await parseExcel(file);
      } else {
        toast.error("Formato não suportado. Use JSON, CSV ou Excel.");
        setImporting(false);
        e.target.value = "";
        return;
      }

      if (!Array.isArray(data)) data = [data];

      const cleaned = data.map(item => {
        const { id, created_date, updated_date, created_by, ...rest } = item;
        return coerceItem(rest, entityType);
      });

      let imported = 0;
      let skipped = 0;

      if (entityType === "Vehicle") {
        // Deduplicate by license_plate against existing vehicles
        const existingPlates = new Set(vehicles.map(v => (v.license_plate || "").toLowerCase().trim()));
        const toCreate = cleaned.filter(v => {
          const plate = (v.license_plate || "").toLowerCase().trim();
          if (plate && existingPlates.has(plate)) { skipped++; return false; }
          return true;
        });
        if (toCreate.length > 0) {
          const created = await base44.entities.Vehicle.bulkCreate(toCreate);
          imported = created.length;
        }
      } else {
        // Expense or Charging: remap vehicle_id and deduplicate
        const entity = entityType === "Charging" ? base44.entities.Charging : base44.entities.Expense;
        const dateField = entityType === "Charging" ? "start_datetime" : "date";
        const amtField = entityType === "Charging" ? "total_cost" : "amount";

        // Build vehicle lookup: by old ID, by license_plate, or single-vehicle fallback
        const findVehicleId = (oldId, plate) => {
          if (oldId && vehicles.find(v => v.id === oldId)) return oldId;
          if (plate) {
            const match = vehicles.find(v => (v.license_plate || "").toLowerCase().trim() === plate.toLowerCase().trim());
            if (match) return match.id;
          }
          if (vehicles.length === 1) return vehicles[0].id;
          return null;
        };

        // Build dedup keys from existing records (vehicle_id + date + amount)
        const existingKeys = new Set(
          (entityType === "Charging" ? chargings : expenses).map(r =>
            `${r.vehicle_id}|${r[dateField]}|${Number(r[amtField]) || 0}`
          )
        );

        const toCreate = [];
        for (const item of cleaned) {
          const vehicle_id = findVehicleId(item.vehicle_id, item.license_plate);
          if (!vehicle_id) { skipped++; continue; }
          const amt = Number(item[amtField]) || 0;
          const key = `${vehicle_id}|${item[dateField]}|${amt}`;
          if (existingKeys.has(key)) { skipped++; continue; }
          existingKeys.add(key);
          const { license_plate, ...rest } = item;
          toCreate.push({ ...rest, vehicle_id });
        }

        if (toCreate.length > 0) {
          await entity.bulkCreate(toCreate);
          imported = toCreate.length;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} registos importados!${skipped > 0 ? ` ${skipped} duplicados ignorados.` : ""}`);
      } else {
        toast.info(`${skipped} registos duplicados ou sem veículo associado — ignorados.`);
      }

      const [v, ex, c] = await Promise.all([
        base44.entities.Vehicle.list(),
        base44.entities.Expense.list("-date", 1000),
        base44.entities.Charging.list("-start_datetime", 1000),
      ]);
      setVehicles(v);
      setExpenses(ex);
      setChargings(c);
    } catch (err) {
      toast.error("Erro ao importar: " + err.message);
    }
    setImporting(false);
    e.target.value = "";
  };

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleDeleteAll = async () => {
    setDeleting(true);
    const [allV, allE, allC, allP, allD, allN, allI, allS, allIns, allCl, allLoc] = await Promise.all([
      base44.entities.Vehicle.list("-created_date", 1000),
      base44.entities.Expense.list("-date", 1000),
      base44.entities.Charging.list("-start_datetime", 1000),
      base44.entities.VehiclePart.list("-created_date", 1000),
      base44.entities.VehicleDocument.list("-created_date", 1000),
      base44.entities.Notification.list("-created_date", 1000),
      base44.entities.VehicleIssue.list("-created_date", 1000),
      base44.entities.MaintenanceSchedule.list("-created_date", 1000),
      base44.entities.Insurance.list("-created_date", 1000),
      base44.entities.InspectionChecklist.list("-created_date", 1000),
      base44.entities.Location.list("-created_date", 1000),
    ]);
    await Promise.all([
      ...allV.map(r => base44.entities.Vehicle.delete(r.id)),
      ...allE.map(r => base44.entities.Expense.delete(r.id)),
      ...allC.map(r => base44.entities.Charging.delete(r.id)),
      ...allP.map(r => base44.entities.VehiclePart.delete(r.id)),
      ...allD.map(r => base44.entities.VehicleDocument.delete(r.id)),
      ...allN.map(r => base44.entities.Notification.delete(r.id)),
      ...allI.map(r => base44.entities.VehicleIssue.delete(r.id)),
      ...allS.map(r => base44.entities.MaintenanceSchedule.delete(r.id)),
      ...allIns.map(r => base44.entities.Insurance.delete(r.id)),
      ...allCl.map(r => base44.entities.InspectionChecklist.delete(r.id)),
      ...allLoc.map(r => base44.entities.Location.delete(r.id)),
    ]);
    setVehicles([]); setExpenses([]); setChargings([]); setParts([]); setDocs([]); setNotifications([]);
    setIssues([]); setSchedules([]); setInsurances([]); setChecklists([]); setLocations([]);
    setDeleteConfirm(false);
    setDeleting(false);
    toast.success("Todos os dados foram apagados.");
  };

  const handleRepairVehicleIds = async () => {
    // Try to fix expenses where vehicle_id doesn't match any existing vehicle
    const vehicleIds = new Set(vehicles.map(v => v.id));
    const broken = expenses.filter(e => e.vehicle_id && !vehicleIds.has(e.vehicle_id));
    if (broken.length === 0) { toast.info("Nenhuma despesa com veículo inválido encontrada."); return; }

    // If only one vehicle, assign all broken expenses to it
    if (vehicles.length === 1) {
      await Promise.all(broken.map(e => base44.entities.Expense.update(e.id, { vehicle_id: vehicles[0].id })));
      toast.success(`${broken.length} despesas corrigidas para "${vehicles[0].brand} ${vehicles[0].model}".`);
    } else {
      toast.error(`${broken.length} despesas com veículo inválido. Com múltiplos veículos, reimporte o backup.`);
    }
    const ex = await base44.entities.Expense.list("-date", 1000);
    setExpenses(ex);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-4 space-y-6 pb-24">
      <div className="bg-gradient-to-br from-fuchsia-500 to-pink-600 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-fuchsia-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5 opacity-80" />
          Importar / Exportar
        </h1>
        <p className="text-white/60 text-xs mt-0.5">Transferir dados da aplicação</p>
      </div>

      {/* Repair broken vehicle links */}
      {expenses.some(e => !vehicles.find(v => v.id === e.vehicle_id)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800 text-sm">Despesas com veículo não associado</p>
            <p className="text-xs text-amber-700 mt-0.5">Algumas despesas importadas têm um vehicle_id inválido.</p>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 shrink-0" onClick={handleRepairVehicleIds}>
            Corrigir
          </Button>
        </div>
      )}

      {/* Full Backup */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">Backup Completo</h2>
        <Card className="p-5 border-l-4 border-l-primary bg-primary/[0.03]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
                <p className="font-medium">Todos os dados</p>
                <p className="text-xs text-muted-foreground">
                  {vehicles.length} veículos · {expenses.length} despesas · {chargings.length} carregamentos · {parts.length} peças · {docs.length} documentos · {notifications.length} lembretes · {issues.length} avarias · {schedules.length} manutenções · {insurances.length} seguros · {checklists.length} checklists · {locations.length} locais
                </p>
              </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAllJSON}>
                <Download className="w-3.5 h-3.5" /> Backup JSON
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAllZIP}>
                <Archive className="w-3.5 h-3.5" /> Backup ZIP
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportFullReportXLSX({
                vehicles, expenses, chargings, parts, docs, notifications, issues, schedules, insurances, checklists, locations, periodLabel: "Completo"
              })}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel Completo
              </Button>
              <label className="inline-flex">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors ${importing ? "opacity-60 pointer-events-none" : ""}`}>
                  <Upload className="w-3.5 h-3.5" /> {importing ? "A importar..." : "Restaurar Backup"}
                </span>
                <input type="file" accept=".json" onChange={handleImportAll} className="hidden" disabled={importing} />
              </label>
            </div>
          </div>
        </Card>
      </div>

      {/* Backup Google Sheets */}
      <GoogleSheetsBackup onImported={async () => {
        const [v, e, p, d, n, c, i, s, ins, cl, loc] = await Promise.all([
          base44.entities.Vehicle.list(),
          base44.entities.Expense.list("-date", 1000),
          base44.entities.VehiclePart.list(),
          base44.entities.VehicleDocument.list(),
          base44.entities.Notification.list(),
          base44.entities.Charging.list("-start_datetime", 1000),
          base44.entities.VehicleIssue.list("-created_date", 1000),
          base44.entities.MaintenanceSchedule.list("-created_date", 1000),
          base44.entities.Insurance.list("-created_date", 1000),
          base44.entities.InspectionChecklist.list("-created_date", 1000),
          base44.entities.Location.list("name", 1000),
        ]);
        setVehicles(v); setExpenses(e); setParts(p); setDocs(d); setNotifications(n);
        setChargings(c); setIssues(i); setSchedules(s); setInsurances(ins); setChecklists(cl); setLocations(loc);
      }} />

      {/* Export Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">Exportar por Tipo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4 border-l-4 border-l-blue-500 bg-blue-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileJson className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Veículos</p>
                <p className="text-xs text-muted-foreground">{vehicles.length} registos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportJSON(vehicles, "veiculos.json")}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportXLSX(vehicles, "veiculos.xlsx", "Veículos")}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border-l-4 border-l-amber-500 bg-amber-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <FileJson className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Despesas</p>
                <p className="text-xs text-muted-foreground">{expenses.length} registos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportJSON(expenses, "despesas.json")}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportXLSX(expenses, "despesas.xlsx", "Despesas")}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border-l-4 border-l-sky-500 bg-sky-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                <FileJson className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <p className="font-medium">Carregamentos</p>
                <p className="text-xs text-muted-foreground">{chargings.length} registos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportJSON(chargings, "carregamentos.json")}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => exportXLSX(chargings, "carregamentos.xlsx", "Carregamentos")}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Import Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">Importar por Tipo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">Importar Veículos</p>
                <p className="text-xs text-muted-foreground">JSON ou Excel</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadTemplate(TEMPLATES.Vehicle)}>
                <FileDown className="w-3.5 h-3.5 mr-1.5" /> Modelo
              </Button>
              <label className="flex-1">
                <input type="file" accept=".json,.xlsx,.xls" onChange={(e) => handleImport(e, "Vehicle")} className="hidden" />
                <span className="block w-full text-center text-sm font-medium px-3 py-2 rounded-lg border border-input bg-background text-primary cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" /> Importar
                </span>
              </label>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border-l-4 border-l-orange-500 bg-orange-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Importar Despesas</p>
                <p className="text-xs text-muted-foreground">JSON ou Excel</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadTemplate(TEMPLATES.Expense)}>
                <FileDown className="w-3.5 h-3.5 mr-1.5" /> Modelo
              </Button>
              <label className="flex-1">
                <input type="file" accept=".json,.xlsx,.xls" onChange={(e) => handleImport(e, "Expense")} className="hidden" />
                <span className="block w-full text-center text-sm font-medium px-3 py-2 rounded-lg border border-input bg-background text-primary cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" /> Importar
                </span>
              </label>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border-l-4 border-l-cyan-500 bg-cyan-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <p className="font-medium">Importar Carregamentos</p>
                <p className="text-xs text-muted-foreground">JSON ou Excel</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadTemplate(TEMPLATES.Charging)}>
                <FileDown className="w-3.5 h-3.5 mr-1.5" /> Modelo
              </Button>
              <label className="flex-1">
                <input type="file" accept=".json,.xlsx,.xls" onChange={(e) => handleImport(e, "Charging")} className="hidden" />
                <span className="block w-full text-center text-sm font-medium px-3 py-2 rounded-lg border border-input bg-background text-primary cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" /> Importar
                </span>
              </label>
            </div>
          </Card>
        </div>
      </div>

      {/* Zona de Perigo */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-destructive text-center">Zona de Perigo</h2>
        <Card className="p-5 border-destructive/30 border-l-4 border-l-destructive bg-destructive/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <p className="font-medium">Apagar todos os dados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                 Remove permanentemente {vehicles.length} veículos, {expenses.length} despesas, {chargings.length} carregamentos, {parts.length} peças, {docs.length} documentos, {notifications.length} lembretes, {issues.length} avarias, {schedules.length} manutenções, {insurances.length} seguros, {checklists.length} checklists e {locations.length} locais.
               </p>
            </div>
            {!deleteConfirm ? (
              <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setDeleteConfirm(true)}>
                Apagar Tudo
              </Button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deleting}>
                  {deleting ? "A apagar..." : "Confirmar"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}