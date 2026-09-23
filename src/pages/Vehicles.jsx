import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Car, Pencil, Trash2, Calendar, Gauge, MoreHorizontal, ChevronRight, Wrench, ClipboardCheck, ShieldCheck, Landmark } from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";
import { getNextInspectionDate } from "@/lib/inspectionRules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import VehicleForm from "../components/vehicles/VehicleForm";
import VehicleIssuesDialog from "../components/vehicles/VehicleIssuesDialog";
import InsuranceDialog from "../components/vehicles/InsuranceDialog";
import LoanDialog from "../components/vehicles/LoanDialog";
import { cn } from "@/lib/utils";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [issuesVehicle, setIssuesVehicle] = useState(null);
  const [insuranceVehicle, setInsuranceVehicle] = useState(null);
  const [loanVehicle, setLoanVehicle] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    const vehicles = await base44.entities.Vehicle.list("-created_date");
    const expenses = await base44.entities.Expense.list("-date", 1000);

    // Update current mileage from the highest mileage across all expenses
    const updatedVehicles = vehicles.map(vehicle => {
      const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id && e.mileage_at_expense);
      const maxMileage = vehicleExpenses.length > 0
        ? Math.max(...vehicleExpenses.map(e => e.mileage_at_expense))
        : vehicle.mileage;
      const inspExpenses = expenses
        .filter(e => e.vehicle_id === vehicle.id && e.sub_category === "Inspeção")
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastInspectionDate = inspExpenses.length > 0 ? inspExpenses[0].date : null;
      const nextInspection = getNextInspectionDate(vehicle.year, lastInspectionDate, vehicle.registration_date);
      return {
        ...vehicle,
        current_mileage: maxMileage || vehicle.mileage,
        next_inspection_date: nextInspection ? format(nextInspection, "yyyy-MM-dd") : null,
      };
    });

    // Fetch active insurance for each vehicle
    const insurances = await base44.entities.Insurance.list("-start_date", 500);
    const insByVehicle = {};
    for (const ins of insurances) {
      if (!ins.vehicle_id) continue;
      if (!insByVehicle[ins.vehicle_id] || !insByVehicle[ins.vehicle_id].is_active) {
        if (ins.is_active !== false) insByVehicle[ins.vehicle_id] = ins;
      }
    }
    const withInsurance = updatedVehicles.map(v => ({
      ...v,
      active_insurance: insByVehicle[v.id] || null,
    }));

    setVehicles(withInsurance);
    setExpenses(expenses);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (editVehicle) {
      await base44.entities.Vehicle.update(editVehicle.id, data);
    } else {
      await base44.entities.Vehicle.create(data);
    }
    setDialogOpen(false);
    setEditVehicle(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Vehicle.delete(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full space-y-5 px-4 pb-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-violet-500/20 flex items-center justify-between" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Car className="w-5 h-5 opacity-80" />
            Veículos
          </h1>
          <p className="text-white/60 text-xs mt-0.5">Gerir as suas viaturas</p>
        </div>
        <Button onClick={() => { setEditVehicle(null); setDialogOpen(true); }} size="sm" className="gap-2 rounded-xl bg-white text-violet-700 hover:bg-white/90 font-semibold h-9 text-xs">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-14 text-center card-shadow">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-bold">Nenhum veículo</h3>
          <p className="text-muted-foreground text-sm mt-1">Adicione o seu primeiro veículo para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} onClick={() => navigate(`/vehicles/${vehicle.id}`)} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-200 card-shadow group cursor-pointer">
              <div className="h-32 flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 relative overflow-hidden">
                {vehicle.image_url ? (
                  <img src={vehicle.image_url} alt={vehicle.brand} className="w-full h-full object-cover" />
                ) : (
                  <Car className="w-14 h-14 text-primary/25" />
                )}
                <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur hover:bg-white rounded-xl shadow-sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem asChild className="rounded-lg">
                        <Link to={`/vehicles/${vehicle.id}`}><ChevronRight className="w-3.5 h-3.5 mr-2" /> Ver Detalhes</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIssuesVehicle(vehicle)} className="rounded-lg">
                        <Wrench className="w-3.5 h-3.5 mr-2" /> Revisão
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setInsuranceVehicle(vehicle)} className="rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Seguro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLoanVehicle(vehicle)} className="rounded-lg">
                        <Landmark className="w-3.5 h-3.5 mr-2" /> Empréstimo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditVehicle(vehicle); setDialogOpen(true); }} className="rounded-lg">
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(vehicle.id)} className="text-destructive rounded-lg">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-base leading-tight">{vehicle.brand} {vehicle.model}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {vehicle.license_plate && (
                    <span className="font-mono text-[11px] bg-secondary border border-border px-2 py-0.5 rounded-lg font-semibold tracking-widest">{vehicle.license_plate}</span>
                  )}
                  {vehicle.year && <span className="text-xs text-muted-foreground">{vehicle.year}</span>}
                  <span className="text-xs text-muted-foreground">{vehicle.fuel_type}</span>
                </div>
                {vehicle.current_mileage && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Gauge className="w-3 h-3" />
                    <span>{vehicle.current_mileage.toLocaleString()} km</span>
                  </div>
                )}
                {vehicle.next_inspection_date && (() => {
                  const inspDate = new Date(vehicle.next_inspection_date + "T12:00:00");
                  const overdue = isPast(inspDate);
                  const daysLeft = differenceInDays(inspDate, new Date());
                  const soon = !overdue && daysLeft <= 30;
                  return (
                    <div className={cn("mt-2 flex items-center gap-1.5 text-xs border-t border-border pt-2",
                      overdue ? "text-destructive" : soon ? "text-amber-600" : "text-muted-foreground")}>
                      <ClipboardCheck className="w-3 h-3 shrink-0" />
                      <span>Inspeção: {format(inspDate, "d MMM yyyy", { locale: pt })}</span>
                      {overdue && <span className="font-semibold">· em atraso</span>}
                      {!overdue && soon && <span>· em {daysLeft}d</span>}
                    </div>
                  );
                })()}
                {vehicle.last_maintenance_date && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>Revisão: {format(new Date(vehicle.last_maintenance_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</span>
                    {vehicle.last_maintenance_km && <span>· {vehicle.last_maintenance_km.toLocaleString()} km</span>}
                  </div>
                )}
                {vehicle.active_insurance ? (() => {
                  const ins = vehicle.active_insurance;
                  const endDate = new Date(ins.end_date + "T12:00:00");
                  const daysLeft = differenceInDays(endDate, new Date());
                  const expired = daysLeft < 0;
                  const soon = !expired && daysLeft <= 30;
                  return (
                    <div className={cn("mt-1 flex items-center gap-1.5 text-xs border-t border-border pt-1",
                      expired ? "text-destructive" : soon ? "text-amber-600" : "text-muted-foreground")}>
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span>Seguro: {ins.insurer}</span>
                      {expired
                        ? <span className="font-semibold">· expirado</span>
                        : <span>· até {format(endDate, "d MMM yyyy", { locale: pt })}{soon ? ` · em ${daysLeft}d` : ""}</span>}
                    </div>
                  );
                })() : (
                  <div className="mt-1 flex items-center gap-1.5 text-xs border-t border-border pt-1 text-muted-foreground/60">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>Sem seguro registado</span>
                  </div>
                )}
                {(() => {
                  const totalLoan = Number(vehicle.loan_amount) || 0;
                  const loanExpenses = expenses.filter(e => e.vehicle_id === vehicle.id && e.category === "Empréstimos");
                  const paid = loanExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                  const remaining = totalLoan - paid;
                  if (totalLoan <= 0) return null;
                  return (
                    <div className="mt-1 flex items-center gap-1.5 text-xs border-t border-border pt-1 text-muted-foreground">
                      <Landmark className="w-3 h-3 shrink-0" />
                      <span>Crédito: {totalLoan.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
                      <span className="text-muted-foreground/70">· falta {remaining.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editVehicle ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <VehicleForm vehicle={editVehicle} onSave={handleSave} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <VehicleIssuesDialog vehicle={issuesVehicle} onClose={() => setIssuesVehicle(null)} />
      <InsuranceDialog vehicle={insuranceVehicle} onClose={() => setInsuranceVehicle(null)} />
      <LoanDialog vehicle={loanVehicle} onClose={() => { setLoanVehicle(null); load(); }} />
    </div>
  );
}