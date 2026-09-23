import { useState, useEffect, useRef } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { base44 } from "@/api/base44Client";
import { enqueue } from "@/lib/offlineQueue";
import { saveCache, loadCache } from "@/lib/dataCache";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { maybeCreateAutoNotification } from "@/lib/autoNotifications";
import { syncVehicleMileage } from "@/lib/vehicleMileage";
import { Link } from "react-router-dom";
import { Search, BookOpen, ChevronRight, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ExpenseForm from "../components/expenses/ExpenseForm";
import ExpenseRow from "../components/expenses/ExpenseRow";
import ChargingForm from "../components/charging/ChargingForm";
import NotificationForm from "../components/notifications/NotificationForm";
import VehicleIssueForm from "@/components/vehicles/VehicleIssueForm";
import ChecklistForm from "@/components/vehicles/ChecklistForm";
import InsuranceForm from "@/components/vehicles/InsuranceForm";
import VehicleSummary from "../components/dashboard/VehicleSummary";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import FuelEstimateBar from "../components/dashboard/FuelEstimateBar";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast as radixToast } from "@/components/ui/use-toast";

function groupByMonth(expenses) {
  const groups = {};
  // Sort by date desc, then by mileage desc (to break same-day ties)
  const sorted = [...expenses].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.mileage_at_expense || 0) - (a.mileage_at_expense || 0);
  });
  sorted.forEach(e => {
    const key = format(new Date(e.date + "T12:00:00"), "MMMM yyyy", { locale: pt }).toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [chargings, setChargings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [defaultCategory, setDefaultCategory] = useState(null);
  const [defaultSubCategory, setDefaultSubCategory] = useState(null);
  const [isServiceMode, setIsServiceMode] = useState(false);
  const [chargingDialogOpen, setChargingDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueVehicleId, setIssueVehicleId] = useState("");
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [checklistVehicleId, setChecklistVehicleId] = useState("");
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [insuranceVehicleId, setInsuranceVehicleId] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { isOnline, refresh: refreshOffline } = useOfflineSync();

  const mountedRef = useRef(true);

  const load = async () => {
    try {
      const [e, v, c] = await Promise.all([
        base44.entities.Expense.list("-date", 500),
        base44.entities.Vehicle.list(),
        base44.entities.Charging.list("-start_datetime", 500)
      ]);
      if (!mountedRef.current) return;
      setExpenses(e);
      setVehicles(v);
      setChargings(c);
      saveCache('expenses', e);
      saveCache('vehicles', v);
      saveCache('chargings', c);
    } catch (err) {
      // Offline — restaurar dados em cache
      if (mountedRef.current) {
        setExpenses(loadCache('expenses') || []);
        setVehicles(loadCache('vehicles') || []);
        setChargings(loadCache('chargings') || []);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const refreshing = usePullToRefresh(load);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, []);

  // Listen for FAB open event from Layout
  useEffect(() => {
    const handler = (e) => {
      const type = e.detail?.type;
      setEditExpense(null);
      setDefaultCategory(null);
      setDefaultSubCategory(null);
      setIsServiceMode(false);
      if (type === "fuel") {
        setDefaultCategory("Combustível");
        setDialogOpen(true);
      } else if (type === "expense") {
        setDefaultCategory("Manutenção");
        setDialogOpen(true);
      } else if (type === "service") {
        setDefaultCategory("Manutenção");
        setDefaultSubCategory("Revisão");
        setIsServiceMode(true);
        setDialogOpen(true);
      } else if (type === "charging") {
        setChargingDialogOpen(true);
      } else if (type === "notification") {
        setNotificationDialogOpen(true);
      } else if (type === "issue") {
        setIssueVehicleId(vehicles.length === 1 ? vehicles[0].id : "");
        setIssueDialogOpen(true);
      } else if (type === "checklist") {
        setChecklistVehicleId(vehicles.length === 1 ? vehicles[0].id : "");
        setChecklistDialogOpen(true);
      } else if (type === "insurance") {
        setInsuranceVehicleId(vehicles.length === 1 ? vehicles[0].id : "");
        setInsuranceDialogOpen(true);
      } else if (type === "loan") {
        setDefaultCategory("Empréstimos");
        setDefaultSubCategory("Crédito");
        setDialogOpen(true);
      } else if (type === "gsheets") {
        (async () => {
          try {
            const user = await base44.auth.me();
            const url = user?.sheets_backup_url;
            if (!url) {
              radixToast({ title: "Backup Google Sheets", description: "Configura o link da spreadsheet em Importar/Exportar primeiro.", variant: "destructive" });
              return;
            }
            const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!m) { radixToast({ title: "Link inválido", description: "Verifica o link da spreadsheet.", variant: "destructive" }); return; }
            radixToast({ title: "Backup Google Sheets", description: "A sincronizar os teus dados..." });
            const names = user?.sheets_backup_names || {};
            const res = await base44.functions.invoke("backupToGoogleSheets", {
              spreadsheet_id: m[1],
              sheets: names,
            });
            if (res.data?.success) {
              const results = res.data.results;
              let totalNew = 0, errors = 0;
              results.forEach(r => { if (r.error) errors++; totalNew += r.new || 0; });
              if (errors > 0) {
                radixToast({ title: "Backup parcial", description: `${totalNew} registos sincronizados, ${errors} página(s) com erro.`, variant: "destructive" });
              } else {
                radixToast({ title: "Backup concluído ✓", description: `${totalNew} registos sincronizados no Google Sheets!` });
              }
            } else {
              radixToast({ title: "Erro no backup", description: res.data?.error || "Erro desconhecido", variant: "destructive" });
            }
          } catch (e) {
            radixToast({ title: "Erro no backup", description: e.message, variant: "destructive" });
          }
          window.dispatchEvent(new CustomEvent("gsheetsBackupDone"));
        })();
      } else {
        setDialogOpen(true);
      }
    };
    window.addEventListener("openFab", handler);
    return () => window.removeEventListener("openFab", handler);
  }, []);

  const openNew = (category, subCategory) => {
    setEditExpense(null);
    setDefaultCategory(category);
    setDefaultSubCategory(subCategory || null);
    setIsServiceMode(false);
    setDialogOpen(true);
  };

  const handleSave = async (data) => {
    const { _parts = [], _docs = [], ...expenseData } = data;
    const tempId = `temp-${Date.now()}`;

    // Optimistic UI
    if (!editExpense) {
      setExpenses(prev => [{ ...expenseData, id: tempId }, ...prev]);
    } else {
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? { ...e, ...expenseData } : e));
    }
    setDialogOpen(false);
    setEditExpense(null);
    setDefaultCategory(null);
    setDefaultSubCategory(null);

    if (!isOnline) {
      // Queue for later sync
      enqueue({
        entity: 'Expense',
        action: editExpense ? 'update' : 'create',
        recordId: editExpense?.id,
        payload: expenseData,
      });
      refreshOffline();
      return;
    }

    let expenseId;
    if (editExpense) {
      await base44.entities.Expense.update(editExpense.id, expenseData);
      expenseId = editExpense.id;
    } else {
      const created = await base44.entities.Expense.create(expenseData);
      expenseId = created.id;
    }
    await Promise.all([
      ..._parts.filter(p => p.name).map(p =>
        base44.entities.VehiclePart.create({ ...p, vehicle_id: expenseData.vehicle_id, expense_id: expenseId, installation_date: expenseData.date, installation_mileage: expenseData.mileage_at_expense })
      ),
      ..._docs.filter(d => d.title).map(d =>
        base44.entities.VehicleDocument.create({ ...d, vehicle_id: expenseData.vehicle_id, expense_id: expenseId, date: expenseData.date })
      ),
      maybeCreateAutoNotification(expenseData, !editExpense),
      syncVehicleMileage(expenseData.vehicle_id, expenseData.mileage_at_expense),
    ]);
    load();
  };

  const handleDelete = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (!isOnline) {
      enqueue({ entity: 'Expense', action: 'delete', recordId: id, payload: {} });
      refreshOffline();
      return;
    }
    await base44.entities.Expense.delete(id);
    load();
  };

  const handleSaveCharging = async (data) => {
    setChargingDialogOpen(false);
    let createdCharging;
    if (editExpense) {
      await base44.entities.Charging.update(editExpense.id, data);
      createdCharging = { ...editExpense, ...data };
    } else {
      createdCharging = await base44.entities.Charging.create(data);
    }
    // Criar despesa associada (mesmo padrão da página Charging)
    const expenseDate = data.start_datetime ? data.start_datetime.split("T")[0] : new Date().toISOString().split("T")[0];
    await base44.entities.Expense.create({
      vehicle_id: data.vehicle_id,
      category: "Combustível",
      sub_category: "Eletricidade",
      amount: data.total_cost || 0,
      date: expenseDate,
      mileage_at_expense: data.odometer || undefined,
      liters: data.kwh_added || undefined,
      price_per_unit: data.price_per_kwh || undefined,
      location: data.location_name || data.location_type || undefined,
      description: data.notes || undefined,
      full_tank: data.soc_end_pct === 100,
      car_avg_consumption: data.car_avg_consumption || undefined,
    });
    if (data.odometer && data.vehicle_id) {
      await syncVehicleMileage(data.vehicle_id, data.odometer);
    }
    load();
  };

  const handleSaveNotification = async (data) => {
    setNotificationDialogOpen(false);
    await base44.entities.Notification.create(data);
    load();
  };

  const handleSaveIssue = async (data) => {
    setIssueDialogOpen(false);
    await base44.entities.VehicleIssue.create(data);
    if (data.odometer && data.vehicle_id) {
      await syncVehicleMileage(data.vehicle_id, data.odometer);
    }
    load();
  };

  const handleSaveChecklist = async (data) => {
    setChecklistDialogOpen(false);
    await base44.entities.InspectionChecklist.create(data);
    if (data.odometer && data.vehicle_id) {
      await syncVehicleMileage(data.vehicle_id, data.odometer);
    }
    load();
  };

  const handleSaveInsurance = async (data) => {
    setInsuranceDialogOpen(false);
    const vehicleId = insuranceVehicleId;
    // 1. Create the Insurance record
    await base44.entities.Insurance.create({ ...data, vehicle_id: vehicleId });
    // 2. Create an Expense (Manutenção / Seguro) for the premium + auto-reminder
    if (data.premium_amount && data.start_date) {
      const expenseData = {
        vehicle_id: vehicleId,
        category: "Seguros",
        sub_category: "Seguro",
        amount: data.premium_amount,
        date: data.start_date,
        description: `Seguro ${data.insurer} — Apólice ${data.policy_number}`,
      };
      await base44.entities.Expense.create(expenseData);
      await maybeCreateAutoNotification(expenseData, true);
    }
    radixToast({ title: "Seguro registado ✓", description: "Despesa e lembrete de renovação criados automaticamente." });
    load();
  };

  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  const resolvedVehicle = filterVehicle;
  const selectedVehicleObj = vehicles.find(v => v.id === resolvedVehicle);

  let filtered = resolvedVehicle === "all" ? expenses : expenses.filter(e => e.vehicle_id === resolvedVehicle);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(e =>
      e.sub_category?.toLowerCase().includes(s) ||
      e.location?.toLowerCase().includes(s) ||
      e.description?.toLowerCase().includes(s)
    );
  }

  // Determine first fuel entry per vehicle per fuel type
  const firstFuelIds = new Set();
  const _firstFuelSeen = {};
  [...expenses]
    .filter(e => e.category === "Combustível")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(e => {
      const isElec = e.sub_category === "Eletricidade";
      const key = `${e.vehicle_id}_${isElec ? "elec" : "fuel"}`;
      if (!_firstFuelSeen[key]) {
        _firstFuelSeen[key] = true;
        firstFuelIds.add(e.id);
      }
    });

  // Calculate consumption per vehicle.
  // Fill-to-fill: consumption[i] = liters[i] / (km[i] - km[i-1]) * 100
  // Always calculated regardless of full_tank flag.
  const consumptionMap = {};
  const consumptionKmMap = {};

  function calcConsumption(entries, isHybridKey) {
    // entries are sorted by mileage_at_expense ascending
    let prevKm = null;

    entries.forEach(entry => {
      const liters = entry.liters || 0;
      const km = entry.mileage_at_expense;

      if (!km || !liters) {
        if (km) prevKm = km;
        return;
      }

      if (prevKm !== null && km > prevKm) {
        const totalKm = km - prevKm;
        const value = ((liters / totalKm) * 100).toFixed(1);
        if (isHybridKey) {
          consumptionMap[entry.id] = consumptionMap[entry.id] || {};
          consumptionMap[entry.id][isHybridKey] = value;
        } else {
          consumptionMap[entry.id] = value;
        }
      }

      prevKm = km;
    });
  }

  const vehicleIds = [...new Set(expenses.map(e => e.vehicle_id))];
  vehicleIds.forEach(vid => {
    const vehicle = vehicleMap[vid];
    const isHybrid = vehicle?.fuel_type === "Híbrido";
    const isElectric = vehicle?.fuel_type === "Elétrico";
    const isEREV = vehicle?.fuel_type === "Híbrido EREV";

    if (isEREV) {
      // EREV: gasolina usa todos os km percorridos desde o abastecimento anterior (combinado)
      // Isso inclui km feitos em modo elétrico, refletindo o consumo real de gasolina por cada 100km
      const fuelEntries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.sub_category !== "Eletricidade" && e.liters && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      // Fill-to-fill over ALL km (incl. electric km) — gives true L/100km for EREV
      let prevKm = null;
      fuelEntries.forEach(entry => {
        const km = entry.mileage_at_expense;
        if (prevKm !== null && km > prevKm) {
          const totalKm = km - prevKm;
          const value = ((entry.liters / totalKm) * 100).toFixed(1);
          consumptionMap[entry.id] = value;
        }
        prevKm = km;
      });

      // Eletricidade: SOC-based via carregamentos, ou fill-to-fill como fallback
      const elecEntries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.sub_category === "Eletricidade" && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      const vehicleChargings = chargings
        .filter(c => c.vehicle_id === vid && c.odometer && c.soc_start_pct != null && c.soc_end_pct != null)
        .sort((a, b) => a.odometer - b.odometer);

      const batteryKwh = vehicle?.battery_capacity;
      const reserve = vehicle?.battery_reserve_pct || 0;
      const usableDenominator = 100 - reserve || 100;

      if (batteryKwh && vehicleChargings.length >= 2) {
        for (let i = 1; i < vehicleChargings.length; i++) {
          const prev = vehicleChargings[i - 1];
          const curr = vehicleChargings[i];
          const kmDriven = curr.odometer - prev.odometer;
          if (kmDriven <= 0) continue;
          const socConsumed = prev.soc_end_pct - curr.soc_start_pct;
          if (socConsumed <= 0) continue;
          // kWh consumidos refletem apenas a fração usável (acima da reserva)
          const kwhConsumed = (socConsumed / usableDenominator) * batteryKwh;
          const consumption = ((kwhConsumed / kmDriven) * 100).toFixed(1);
          const matchedExpense = elecEntries.reduce((best, e) => {
            if (!best) return e;
            return Math.abs(e.mileage_at_expense - curr.odometer) < Math.abs(best.mileage_at_expense - curr.odometer) ? e : best;
          }, null);
          if (matchedExpense && Math.abs(matchedExpense.mileage_at_expense - curr.odometer) <= 50) {
            consumptionMap[matchedExpense.id] = consumption;
          }
        }
      } else {
        calcConsumption(elecEntries, null);
      }
    } else if (isHybrid) {
      const fuelEntries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.sub_category !== "Eletricidade" && e.liters && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);
      calcConsumption(fuelEntries, "Gasolina");
      const elecEntries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.sub_category === "Eletricidade" && e.liters && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);
      calcConsumption(elecEntries, "Eletricidade");
    } else if (isElectric) {
      const entries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.sub_category === "Eletricidade" && e.liters && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);
      calcConsumption(entries, null);
    } else {
      // Combustíveis fósseis (Gasóleo, Gasolina, GPL)
      // Opção 1: cheios = fill-to-fill; parciais = acumulado entre cheios (litros reais)
      const entries = expenses
        .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.liters && e.mileage_at_expense)
        .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

      // 1. Cheios: fill-to-fill clássico (litros reais ÷ km × 100)
      let prevKm = null;
      entries.forEach(entry => {
        const km = entry.mileage_at_expense;
        const liters = entry.liters || 0;
        if (!km || !liters) {
          if (km) prevKm = km;
          return;
        }
        const isCheio = entry.full_tank === true || entry.tank_percentage === 100;
        if (isCheio && prevKm !== null && km > prevKm) {
          const totalKm = km - prevKm;
          consumptionMap[entry.id] = ((liters / totalKm) * 100).toFixed(1);
          consumptionKmMap[entry.id] = totalKm;
        }
        prevKm = km;
      });

      // 2. Parciais: acumular litros reais desde o último "cheio" até ao próximo "cheio"
      let lastCheioKm = null;
      let lastCheioIdx = -1;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isCheio = entry.full_tank === true || entry.tank_percentage === 100;
        if (isCheio) {
          if (lastCheioIdx >= 0 && lastCheioKm !== null) {
            const parciais = entries.slice(lastCheioIdx + 1, i)
              .filter(e => e.mileage_at_expense && e.liters);
            if (parciais.length > 0) {
              const kmTotal = entry.mileage_at_expense - lastCheioKm;
              const litrosTotal = parciais.reduce((s, p) => s + Number(p.liters), 0) + Number(entry.liters);
              if (kmTotal > 0 && litrosTotal > 0) {
                const value = ((litrosTotal / kmTotal) * 100).toFixed(1);
                parciais.forEach(p => {
                  consumptionMap[p.id] = value;
                  consumptionKmMap[p.id] = kmTotal;
                });
              }
            }
          }
          lastCheioKm = entry.mileage_at_expense;
          lastCheioIdx = i;
        }
      }
      // Parciais após o último cheio (sem cheio de fecho) → sem consumo (pendente)
    }
  });

  // Calculate km driven between consecutive odometer readings per vehicle
  // General map: all records with odometer (for non-fuel badges)
  const kmDrivenMap = {};
  vehicleIds.forEach(vid => {
    const withOdo = expenses
      .filter(e => e.vehicle_id === vid && e.mileage_at_expense)
      .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);
    for (let i = 1; i < withOdo.length; i++) {
      const diff = withOdo[i].mileage_at_expense - withOdo[i - 1].mileage_at_expense;
      if (diff > 0) kmDrivenMap[withOdo[i].id] = diff;
    }
  });

  // Fuel-only map: only Combustível records (consistent with consumption calculation)
  const fuelKmDrivenMap = {};
  vehicleIds.forEach(vid => {
    const withOdo = expenses
      .filter(e => e.vehicle_id === vid && e.category === "Combustível" && e.mileage_at_expense)
      .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);
    for (let i = 1; i < withOdo.length; i++) {
      const diff = withOdo[i].mileage_at_expense - withOdo[i - 1].mileage_at_expense;
      if (diff > 0) fuelKmDrivenMap[withOdo[i].id] = diff;
    }
  });

  const monthGroups = groupByMonth(filtered);
  const sortedMonths = Object.keys(monthGroups);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {refreshing && (
        <div className="flex justify-center py-2 bg-primary/10">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white px-4 pb-4 sticky top-0 z-20 shadow-lg shadow-violet-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Registos</h1>
              <p className="text-xs text-white/60 mt-0.5">Registo de despesas</p>
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`p-2.5 rounded-xl transition-all duration-200 ${searchOpen ? "bg-white/20" : "hover:bg-white/10"}`}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {searchOpen && (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar despesas..."
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/15 placeholder-white/50 text-white outline-none border border-white/20 mb-3 backdrop-blur"
          />
        )}

        {/* Vehicle tabs */}
        {vehicles.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {vehicles.map(v => (
              <button
                key={v.id}
                onClick={() => setFilterVehicle(v.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  resolvedVehicle === v.id
                    ? "bg-white text-primary shadow-sm"
                    : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
                }`}
              >
                {v.brand} {v.model}
              </button>
            ))}
            {vehicles.length > 1 && (
              <button
                onClick={() => setFilterVehicle("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  resolvedVehicle === "all"
                    ? "bg-white text-primary shadow-sm"
                    : "bg-white/15 text-white/85 hover:bg-white/25 border border-white/10"
                }`}
              >
                Todos
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pt-4 pb-6 space-y-4">
        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold">Sem registos</p>
            <p className="text-muted-foreground text-sm mt-1">Prima o botão + para adicionar.</p>
          </div>
        ) : (
          <div>
            {sortedMonths.map((month, mi) => {
              const entries = monthGroups[month];
              const monthTotal = entries.reduce((s, e) => s + (e.amount || 0), 0);
              return (
                <div key={month} className="mb-4">
                  <div className="flex items-center justify-between px-1 mb-3">
                    <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">{month}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">€{monthTotal.toFixed(2)}</span>
                  </div>
                  <div className="space-y-0">
                    {entries.map((expense, ei) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        vehicle={vehicleMap[expense.vehicle_id]}
                        consumption={consumptionMap[expense.id]}
                        consumptionKm={consumptionKmMap[expense.id]}
                        kmDriven={expense.category === "Combustível" ? fuelKmDrivenMap[expense.id] : kmDrivenMap[expense.id]}
                        isFirstFuel={firstFuelIds.has(expense.id)}
                        isLast={mi === sortedMonths.length - 1 && ei === entries.length - 1}
                        onEdit={() => { setEditExpense(expense); setDefaultCategory(expense.category); setDefaultSubCategory(null); setIsServiceMode(false); setDialogOpen(true); }}
                        onDelete={() => handleDelete(expense.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-1 pt-2 border-t border-border mt-2">
              <span className="text-xs text-muted-foreground">{filtered.length} registos</span>
              <span className="text-xs font-bold text-foreground">€{filtered.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)} total</span>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditExpense(null); setDefaultCategory(null); setDefaultSubCategory(null); setIsServiceMode(false); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editExpense ? "Editar Despesa" : defaultCategory ? `Nova Despesa — ${defaultCategory}` : "Nova Despesa"}
            </DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editExpense}
            vehicles={vehicles}
            allExpenses={expenses}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditExpense(null); setDefaultCategory(null); setDefaultSubCategory(null); setIsServiceMode(false); }}
            defaultCategory={defaultCategory}
            defaultSubCategory={defaultSubCategory}
            serviceMode={isServiceMode}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Carregamento */}
      <Dialog open={chargingDialogOpen} onOpenChange={setChargingDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Carregamento</DialogTitle>
          </DialogHeader>
          <ChargingForm
            vehicles={vehicles.filter(v => ["Elétrico", "Híbrido", "Híbrido EREV"].includes(v.fuel_type))}
            lastCharging={chargings.find(c => c.vehicle_id === vehicles.find(v => ["Elétrico", "Híbrido", "Híbrido EREV"].includes(v.fuel_type))?.id)}
            history={chargings}
            onSave={handleSaveCharging}
            onCancel={() => setChargingDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Lembrete */}
      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lembrete</DialogTitle>
          </DialogHeader>
          <NotificationForm
            vehicles={vehicles}
            initial={{ type: "Revisão", due_date: new Date().toISOString().split("T")[0] }}
            onSave={handleSaveNotification}
            onCancel={() => setNotificationDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Checklist de Inspeção */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist de Inspeção</DialogTitle>
          </DialogHeader>
          {vehicles.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Veículo</label>
              <select
                value={checklistVehicleId}
                onChange={e => setChecklistVehicleId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecionar veículo</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>
                ))}
              </select>
            </div>
          )}
          {vehicles.length === 1 && (
            <ChecklistForm vehicle={vehicles[0]} onSave={handleSaveChecklist} onCancel={() => setChecklistDialogOpen(false)} />
          )}
          {vehicles.length > 1 && checklistVehicleId && (
            <ChecklistForm vehicle={vehicles.find(v => v.id === checklistVehicleId)} onSave={handleSaveChecklist} onCancel={() => setChecklistDialogOpen(false)} />
          )}
          {vehicles.length > 1 && !checklistVehicleId && (
            <p className="text-sm text-muted-foreground text-center py-4">Seleciona um veículo para continuar.</p>
          )}
          <Button variant="outline" onClick={() => setChecklistDialogOpen(false)} className="w-full">Cancelar</Button>
        </DialogContent>
      </Dialog>

      {/* Dialog de Seguro */}
      <Dialog open={insuranceDialogOpen} onOpenChange={setInsuranceDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Seguro</DialogTitle>
          </DialogHeader>
          {vehicles.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Veículo</label>
              <select
                value={insuranceVehicleId}
                onChange={e => setInsuranceVehicleId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecionar veículo</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>
                ))}
              </select>
            </div>
          )}
          {vehicles.length === 1 && (
            <InsuranceForm onSave={handleSaveInsurance} onCancel={() => setInsuranceDialogOpen(false)} />
          )}
          {vehicles.length > 1 && insuranceVehicleId && (
            <InsuranceForm onSave={handleSaveInsurance} onCancel={() => setInsuranceDialogOpen(false)} />
          )}
          {vehicles.length > 1 && !insuranceVehicleId && (
            <p className="text-sm text-muted-foreground text-center py-4">Seleciona um veículo para continuar.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Avarias */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Avaria / Nota</DialogTitle>
          </DialogHeader>
          {vehicles.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Veículo</label>
              <select
                value={issueVehicleId}
                onChange={e => setIssueVehicleId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecionar veículo</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>
                ))}
              </select>
            </div>
          )}
          {vehicles.length === 1 && (
            <VehicleIssueForm
              vehicle={vehicles[0]}
              onSave={handleSaveIssue}
            />
          )}
          {vehicles.length > 1 && issueVehicleId && (
            <VehicleIssueForm
              vehicle={vehicles.find(v => v.id === issueVehicleId)}
              onSave={handleSaveIssue}
            />
          )}
          {vehicles.length > 1 && !issueVehicleId && (
            <p className="text-sm text-muted-foreground text-center py-4">Seleciona um veículo para continuar.</p>
          )}
          <Button variant="outline" onClick={() => setIssueDialogOpen(false)} className="w-full">Cancelar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}