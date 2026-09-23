import { useState, useEffect, useRef } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { base44 } from "@/api/base44Client";
import { enqueue } from "@/lib/offlineQueue";
import { saveCache, loadCache } from "@/lib/dataCache";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { maybeCreateAutoNotification } from "@/lib/autoNotifications";
import { syncVehicleMileage } from "@/lib/vehicleMileage";
import { Link } from "react-router-dom";
import { LayoutDashboard, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ExpenseForm from "../components/expenses/ExpenseForm";
import ChargingForm from "../components/charging/ChargingForm";
import NotificationForm from "../components/notifications/NotificationForm";
import VehicleIssueForm from "@/components/vehicles/VehicleIssueForm";
import ChecklistForm from "@/components/vehicles/ChecklistForm";
import InsuranceForm from "@/components/vehicles/InsuranceForm";
import VehicleSummary from "../components/dashboard/VehicleSummary";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import FuelEstimateBar from "../components/dashboard/FuelEstimateBar";
import OfflineSyncBanner from "@/components/dashboard/OfflineSyncBanner";
import MaintenanceAlerts from "../components/dashboard/MaintenanceAlerts";
import MonthlyDashboard from "../components/dashboard/MonthlyDashboard";
import { toast as radixToast } from "@/components/ui/use-toast";

export default function DashboardHome() {
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [chargings, setChargings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicle, setFilterVehicle] = useState("all");

  // FAB dialog state
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

  const { isOnline, refresh: refreshOffline } = useOfflineSync();
  const mountedRef = useRef(true);

  const load = async () => {
    try {
      const [e, v, c, s, n] = await Promise.all([
        base44.entities.Expense.list("-date", 500),
        base44.entities.Vehicle.list(),
        base44.entities.Charging.list("-start_datetime", 500),
        base44.entities.MaintenanceSchedule.list("-created_date", 500),
        base44.entities.Notification.list("-due_date", 500),
      ]);
      if (!mountedRef.current) return;
      setExpenses(e);
      setVehicles(v);
      setChargings(c);
      setSchedules(s);
      setNotifications(n);
      saveCache('expenses', e);
      saveCache('vehicles', v);
      saveCache('chargings', c);
    } catch (err) {
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

  // Listen for FAB open event
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
            const res = await base44.functions.invoke("backupToGoogleSheets", { spreadsheet_id: m[1], sheets: names });
            if (res.data?.success) {
              const results = res.data.results;
              let totalNew = 0, errors = 0;
              results.forEach(r => { if (r.error) errors++; totalNew += r.new || 0; });
              if (errors > 0) {
                radixToast({ title: "Backup parcial", description: `${totalNew} novos registos, ${errors} página(s) com erro.`, variant: "destructive" });
              } else if (totalNew === 0) {
                radixToast({ title: "Backup concluído", description: "Tudo atualizado — sem novos registos." });
              } else {
                radixToast({ title: "Backup concluído ✓", description: `${totalNew} novos registos adicionados!` });
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
  }, [vehicles]);

  const handleSave = async (data) => {
    const { _parts = [], _docs = [], ...expenseData } = data;
    setDialogOpen(false);
    setEditExpense(null);
    setDefaultCategory(null);
    setDefaultSubCategory(null);
    setIsServiceMode(false);

    if (!isOnline) {
      enqueue({ entity: 'Expense', action: editExpense ? 'update' : 'create', recordId: editExpense?.id, payload: expenseData });
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

  const handleSaveCharging = async (data) => {
    setChargingDialogOpen(false);
    if (editExpense) {
      await base44.entities.Charging.update(editExpense.id, data);
    } else {
      await base44.entities.Charging.create(data);
    }
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
    await base44.entities.Insurance.create({ ...data, vehicle_id: vehicleId });
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

  const resolvedVehicle = filterVehicle;
  const selectedVehicleObj = vehicles.find(v => v.id === resolvedVehicle);

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
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white px-4 pb-4 sticky top-0 z-20 shadow-lg shadow-primary/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 opacity-80" />
              O meu LogBook - Dashboard
            </h1>
            <p className="text-xs text-white/60 mt-0.5">Resumo mensal e alertas</p>
          </div>
        </div>

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
        {/* Maintenance Alerts — prominently visible without opening menu */}
        <MaintenanceAlerts
          vehicles={vehicles}
          expenses={expenses}
          schedules={schedules}
          notifications={notifications}
        />

        {/* Summary Panel */}
        {expenses.length > 0 && (
          <SummaryPanel
            expenses={resolvedVehicle === "all" ? expenses : expenses.filter(e => e.vehicle_id === resolvedVehicle)}
            vehicles={selectedVehicleObj ? [selectedVehicleObj] : vehicles}
          />
        )}

        {/* Offline / Sync status banner */}
        <OfflineSyncBanner />

        {/* Fuel Estimate Bar */}
        {vehicles.length > 0 && expenses.length > 0 && (
          <FuelEstimateBar vehicles={vehicles} expenses={expenses} filterVehicle={filterVehicle} />
        )}

        {/* Vehicle Summary */}
        {selectedVehicleObj && resolvedVehicle !== "all" && (
          <VehicleSummary vehicle={selectedVehicleObj} expenses={expenses} />
        )}

        {/* Monthly Dashboard — total by category + avg consumption */}
        {expenses.length > 0 && (
          <MonthlyDashboard
            expenses={resolvedVehicle === "all" ? expenses : expenses.filter(e => e.vehicle_id === resolvedVehicle)}
            vehicles={selectedVehicleObj ? [selectedVehicleObj] : vehicles}
          />
        )}

        {/* Link to Registos */}
        <Link
          to="/registos"
          className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl py-3 text-sm font-semibold text-primary hover:bg-accent transition-colors card-shadow"
        >
          Ver todos os registos
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Dialog: Despesa */}
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

      {/* Dialog: Carregamento */}
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

      {/* Dialog: Lembrete */}
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

      {/* Dialog: Checklist */}
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

      {/* Dialog: Seguro */}
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

      {/* Dialog: Avaria */}
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
            <VehicleIssueForm vehicle={vehicles[0]} onSave={handleSaveIssue} />
          )}
          {vehicles.length > 1 && issueVehicleId && (
            <VehicleIssueForm vehicle={vehicles.find(v => v.id === issueVehicleId)} onSave={handleSaveIssue} />
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