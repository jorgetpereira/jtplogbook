import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VehicleIssueForm from "./VehicleIssueForm";
import { syncVehicleMileage } from "@/lib/vehicleMileage";
import VehicleIssueCard from "./VehicleIssueCard";
import { Wrench } from "lucide-react";

export default function VehicleIssuesDialog({ vehicle, onClose }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!vehicle) return;
    setLoading(true);
    try {
      const fresh = await base44.entities.VehicleIssue.filter({ vehicle_id: vehicle.id, status: "Aberto" }, "-detected_date");
      setIssues(fresh);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [vehicle?.id]);

  const handleAdd = async (data) => {
    await base44.entities.VehicleIssue.create(data);
    await syncVehicleMileage(data.vehicle_id, data.odometer);
    await load();
  };

  const handleEdit = async (issue, data) => {
    await base44.entities.VehicleIssue.update(issue.id, data);
    await syncVehicleMileage(data.vehicle_id, data.odometer);
    await load();
  };

  const handleResolve = async (issue, resolveData) => {
    await base44.entities.VehicleIssue.update(issue.id, { ...resolveData, status: "Resolvido" });
    setIssues(prev => prev.filter(i => i.id !== issue.id));
  };

  const handleDelete = async (id) => {
    await base44.entities.VehicleIssue.delete(id);
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  return (
    <Dialog open={!!vehicle} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Revisão
          </DialogTitle>
        </DialogHeader>
        {vehicle && (
          <p className="text-xs text-muted-foreground -mt-1">
            {vehicle.brand} {vehicle.model} · Registe avarias e notas entre revisões.
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {issues.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Sem avarias em aberto.</p>
            ) : (
              issues.map(issue => (
                <VehicleIssueCard key={issue.id} issue={issue} onResolve={handleResolve} onDelete={handleDelete} onEdit={handleEdit} />
              ))
            )}
          </div>
        )}
        <div className="border-t border-border pt-4">
          <VehicleIssueForm vehicle={vehicle} onSave={handleAdd} />
        </div>
      </DialogContent>
    </Dialog>
  );
}