import { Wrench, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReportMaintenanceReminder({ vehicles, expenses }) {
  const MAINTENANCE_INTERVAL = 15000;

  const vehicleMaintenanceData = vehicles.map(vehicle => {
    const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id);
    const latestMileage = vehicleExpenses.length > 0
      ? Math.max(...vehicleExpenses.map(e => e.mileage_at_expense || 0).filter(km => km > 0), vehicle.mileage || 0)
      : vehicle.mileage || 0;

    const nextMilestone = (vehicle.last_maintenance_km || 0) + MAINTENANCE_INTERVAL;
    const kmRemaining = nextMilestone - latestMileage;
    const percentageRemaining = ((kmRemaining / MAINTENANCE_INTERVAL) * 100).toFixed(0);

    return {
      id: vehicle.id,
      name: `${vehicle.brand} ${vehicle.model}`,
      currentKm: Math.round(latestMileage),
      nextMilestone,
      kmRemaining: Math.round(kmRemaining),
      percentageRemaining: parseInt(percentageRemaining),
      isUrgent: kmRemaining <= 500
    };
  }).sort((a, b) => a.kmRemaining - b.kmRemaining);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-primary" />
        Quilómetros até à Revisão
      </h3>
      
      <div className="space-y-2">
        {vehicleMaintenanceData.map(vehicle => (
          <div key={vehicle.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">{vehicle.name}</p>
                <span className={cn("text-sm font-bold", vehicle.isUrgent ? "text-destructive" : "text-primary")}>
                  {vehicle.kmRemaining} km
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{vehicle.currentKm} km</span>
                <span>→</span>
                <span>{vehicle.nextMilestone} km</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    vehicle.isUrgent ? "bg-destructive" : "bg-primary"
                  )}
                  style={{ width: `${100 - vehicle.percentageRemaining}%` }}
                />
              </div>
            </div>
            <div className="shrink-0">
              {vehicle.isUrgent && (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              {!vehicle.isUrgent && vehicle.kmRemaining < 2000 && (
                <AlertCircle className="w-5 h-5 text-warning" />
              )}
              {vehicle.kmRemaining >= 2000 && (
                <CheckCircle2 className="w-5 h-5 text-success" />
              )}
            </div>
          </div>
        ))}
      </div>

      {vehicleMaintenanceData.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">Sem dados de quilometragem</p>
      )}
    </div>
  );
}