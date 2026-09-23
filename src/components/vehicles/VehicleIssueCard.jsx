import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, ChevronUp, Gauge, Calendar, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import VehicleIssueForm from "./VehicleIssueForm";

const CATEGORY_STYLES = {
  Motor: "bg-red-100 text-red-700",
  Travões: "bg-orange-100 text-orange-700",
  Elétrico: "bg-blue-100 text-blue-700",
  Eletrónica: "bg-purple-100 text-purple-700",
  Pneus: "bg-amber-100 text-amber-700",
  Suspensão: "bg-cyan-100 text-cyan-700",
  Transmissão: "bg-teal-100 text-teal-700",
  "Ar Condicionado": "bg-sky-100 text-sky-700",
  Outro: "bg-gray-100 text-gray-700"
};

export default function VehicleIssueCard({ issue, onResolve, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resolvedNotes, setResolvedNotes] = useState("");
  const [resolvedDate, setResolvedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const submitResolve = () => {
    onResolve(issue, {
      resolved_notes: resolvedNotes.trim() || undefined,
      resolved_date: resolvedDate || undefined
    });
  };

  const submitEdit = async (data) => {
    await onEdit(issue, data);
    setEditing(false);
    setExpanded(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-3 card-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {issue.maintenance_type === "Preventiva" ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Preventiva
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Corretiva
              </span>
            )}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", CATEGORY_STYLES[issue.category] || CATEGORY_STYLES.Outro)}>
              {issue.category}
            </span>
            {issue.detected_date && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {format(new Date(issue.detected_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
              </span>
            )}
            {issue.odometer != null && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3" /> {Number(issue.odometer).toLocaleString()} km
              </span>
            )}
          </div>
          <p className="font-semibold text-sm mt-1.5">{issue.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button onClick={() => { setEditing(true); setResolving(false); setExpanded(false); }} className="text-muted-foreground hover:text-primary p-1" title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => { if (confirm("Eliminar este registo?")) onDelete(issue.id); }} className="text-muted-foreground hover:text-destructive p-1" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && !editing && (
        <div className="mt-2 space-y-2">
          {issue.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-2">{issue.notes}</p>}
          {issue.image_urls?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {issue.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {editing ? (
        <div className="mt-3 border-t border-border pt-3">
          <VehicleIssueForm vehicle={{ id: issue.vehicle_id }} issue={issue} onSave={submitEdit} />
          <button onClick={() => setEditing(false)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1 mt-1">
            Cancelar
          </button>
        </div>
      ) : resolving ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div>
            <Label className="text-xs">Data de resolução</Label>
            <Input type="date" value={resolvedDate} onChange={e => setResolvedDate(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Notas da reparação</Label>
            <Textarea value={resolvedNotes} onChange={e => setResolvedNotes(e.target.value)} placeholder="O que foi feito..." rows={2} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setResolving(false)}>Cancelar</Button>
            <Button size="sm" className="flex-1 h-8 gap-1.5" onClick={submitResolve}>
              <Check className="w-3.5 h-3.5" /> Marcar Resolvido
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-8 mt-2 gap-1.5 text-xs" onClick={() => setResolving(true)}>
          <Check className="w-3.5 h-3.5" /> Marcar como resolvido
        </Button>
      )}
    </div>
  );
}