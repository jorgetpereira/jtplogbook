import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Gauge, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import ChecklistForm from "./ChecklistForm";

const STATUS_CONFIG = {
  "OK": { Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100", label: "OK" },
  "Atenção": { Icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100", label: "Atenção" },
  "Crítico": { Icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Crítico" },
};

export default function ChecklistCard({ checklist, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const cfg = STATUS_CONFIG[checklist.overall_status] || STATUS_CONFIG["OK"];

  const submitEdit = async (data) => {
    await onEdit(checklist, data);
    setEditing(false);
    setExpanded(false);
  };

  if (editing) {
    return (
      <div className="bg-card border border-border rounded-2xl p-3">
        <ChecklistForm vehicle={{ id: checklist.vehicle_id }} checklist={checklist} onSave={submitEdit} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  const checkedCount = (checklist.items || []).filter(i => i.checked).length;
  const totalCount = (checklist.items || []).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-3 card-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1", cfg.bg, cfg.color)}>
              <cfg.Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            {checklist.date && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {format(new Date(checklist.date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
              </span>
            )}
            {checklist.odometer != null && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3" /> {Number(checklist.odometer).toLocaleString()} km
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {checkedCount}/{totalCount} OK
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button onClick={() => { setEditing(true); setExpanded(false); }} className="text-muted-foreground hover:text-primary p-1" title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => { if (confirm("Eliminar esta checklist?")) onDelete(checklist.id); }} className="text-muted-foreground hover:text-destructive p-1" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {(checklist.items || []).map((item, i) => (
            <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2">
              <div className={cn("shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5",
                item.checked ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
                {item.checked ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{item.label}</p>
                {!item.checked && item.notes && (
                  <p className="text-[11px] text-red-600 italic mt-0.5">{item.notes}</p>
                )}
              </div>
            </div>
          ))}
          {checklist.notes && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-2 mt-1">
              {checklist.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}