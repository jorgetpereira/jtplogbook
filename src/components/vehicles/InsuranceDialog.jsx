import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import InsuranceHistory from "./InsuranceHistory";
import InsuranceForm from "./InsuranceForm";
import { ShieldCheck } from "lucide-react";

export default function InsuranceDialog({ vehicle, onClose }) {
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editInsurance, setEditInsurance] = useState(null);

  const load = async () => {
    if (!vehicle) return;
    setLoading(true);
    try {
      const fresh = await base44.entities.Insurance.filter({ vehicle_id: vehicle.id }, "-start_date");
      setInsurances(fresh);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [vehicle?.id]);

  const handleSave = async (data) => {
    if (editInsurance) await base44.entities.Insurance.update(editInsurance.id, data);
    else await base44.entities.Insurance.create({ ...data, vehicle_id: vehicle.id });
    setFormOpen(false); setEditInsurance(null); load();
  };

  const handleDelete = async (iid) => { await base44.entities.Insurance.delete(iid); load(); };

  return (
    <Dialog open={!!vehicle} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col gap-3 p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Seguros
          </DialogTitle>
        </DialogHeader>
        {vehicle && (
          <p className="text-xs text-muted-foreground -mt-2 shrink-0">
            {vehicle.brand} {vehicle.model} · Histórico de apólices e prémios.
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-8 shrink-0">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <InsuranceHistory
              insurances={insurances}
              onEdit={(ins) => { setEditInsurance(ins); setFormOpen(true); }}
              onDelete={handleDelete}
              onAdd={() => { setEditInsurance(null); setFormOpen(true); }}
            />
          </div>
        )}
        <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditInsurance(null); } }}>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col gap-3 p-4 sm:p-6 overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>{editInsurance ? "Editar Apólice" : "Nova Apólice"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              <InsuranceForm
                insurance={editInsurance}
                onSave={handleSave}
                onCancel={() => { setFormOpen(false); setEditInsurance(null); }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}