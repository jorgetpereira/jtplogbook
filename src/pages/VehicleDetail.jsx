import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Wrench, FileText, Trash2, Pencil, Upload, AlertTriangle, Download, Eye, ArrowDownToLine, CheckCircle2, ClipboardCheck, FileSpreadsheet, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, isPast, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PartForm from "../components/vehicles/PartForm";
import DocumentForm from "../components/vehicles/DocumentForm";
import MaintenanceTimeline from "../components/vehicles/MaintenanceTimeline";
import ChecklistForm from "../components/vehicles/ChecklistForm";
import ChecklistCard from "../components/vehicles/ChecklistCard";
import InsuranceForm from "../components/vehicles/InsuranceForm";
import InsuranceHistory from "../components/vehicles/InsuranceHistory";
import { exportVehicleXLSX } from "@/lib/reportExporter";

const CATEGORY_COLORS = {
  "Motor": "bg-red-100 text-red-700",
  "Travões": "bg-orange-100 text-orange-700",
  "Pneus": "bg-yellow-100 text-yellow-700",
  "Suspensão": "bg-green-100 text-green-700",
  "Elétrico": "bg-blue-100 text-blue-700",
  "Transmissão": "bg-purple-100 text-purple-700",
  "Filtros": "bg-teal-100 text-teal-700",
  "Correia/Corrente": "bg-pink-100 text-pink-700",
  "Iluminação": "bg-cyan-100 text-cyan-700",
  "Outro": "bg-gray-100 text-gray-600",
};

export default function VehicleDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [parts, setParts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [insurances, setInsurances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timeline");
  const [pdfDateFrom, setPdfDateFrom] = useState("");
  const [pdfDateTo, setPdfDateTo] = useState("");
  const [partDialog, setPartDialog] = useState(false);
  const [docDialog, setDocDialog] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [editChecklist, setEditChecklist] = useState(null);
  const [insuranceDialog, setInsuranceDialog] = useState(false);
  const [editInsurance, setEditInsurance] = useState(null);

  const load = async () => {
    const [v, p, d, e, cl, ins] = await Promise.all([
      base44.entities.Vehicle.filter({ id }),
      base44.entities.VehiclePart.filter({ vehicle_id: id }, "-installation_date"),
      base44.entities.VehicleDocument.filter({ vehicle_id: id }, "-date"),
      base44.entities.Expense.filter({ vehicle_id: id }, "-date", 500),
      base44.entities.InspectionChecklist.filter({ vehicle_id: id }, "-date"),
      base44.entities.Insurance.filter({ vehicle_id: id }, "-start_date"),
    ]);
    setVehicle(v[0] || null);
    setParts(p);
    setDocs(d);
    setExpenses(e);
    setChecklists(cl);
    setInsurances(ins);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleSavePart = async (data) => {
    if (editPart) await base44.entities.VehiclePart.update(editPart.id, data);
    else await base44.entities.VehiclePart.create({ ...data, vehicle_id: id });
    setPartDialog(false); setEditPart(null); load();
  };

  const handleSaveDoc = async (data) => {
    if (editDoc) await base44.entities.VehicleDocument.update(editDoc.id, data);
    else await base44.entities.VehicleDocument.create({ ...data, vehicle_id: id });
    setDocDialog(false); setEditDoc(null); load();
  };

  const handleDeletePart = async (pid) => { await base44.entities.VehiclePart.delete(pid); load(); };
  const handleDeleteDoc = async (did) => { await base44.entities.VehicleDocument.delete(did); load(); };

  const handleSaveChecklist = async (data) => {
    if (editChecklist) await base44.entities.InspectionChecklist.update(editChecklist.id, data);
    else await base44.entities.InspectionChecklist.create({ ...data, vehicle_id: id });
    setChecklistDialog(false); setEditChecklist(null); load();
  };
  const handleEditChecklist = async (checklist, data) => {
    await base44.entities.InspectionChecklist.update(checklist.id, data);
    load();
  };
  const handleDeleteChecklist = async (cid) => { await base44.entities.InspectionChecklist.delete(cid); load(); };

  const handleSaveInsurance = async (data) => {
    if (editInsurance) await base44.entities.Insurance.update(editInsurance.id, data);
    else await base44.entities.Insurance.create({ ...data, vehicle_id: id });
    setInsuranceDialog(false); setEditInsurance(null); load();
  };
  const handleDeleteInsurance = async (iid) => { await base44.entities.Insurance.delete(iid); load(); };

  const downloadPartsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Listagem de Peças/Componentes`, 14, 26);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-PT")}`, 14, 32);
    let y = 42;
    parts.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text(`${i + 1}. ${p.name} [${p.category}]`, 14, y);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      const details = [
        p.brand ? `Marca: ${p.brand}` : null,
        p.reference ? `Ref: ${p.reference}` : null,
        p.installation_date ? `Instalado: ${p.installation_date}` : null,
        p.installation_mileage ? `${p.installation_mileage.toLocaleString()} km` : null,
        p.warranty_date ? `Garantia até: ${p.warranty_date}` : null,
        p.cost ? `Custo: €${p.cost.toFixed(2)}` : null,
      ].filter(Boolean).join("  |  ");
      if (details) { y += 5; doc.text(details, 18, y); }
      if (p.notes) { y += 5; doc.text(`Notas: ${p.notes}`, 18, y); }
      y += 8;
    });
    doc.save(`pecas-${vehicle.license_plate}.pdf`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!vehicle) return <div className="p-8 text-center text-muted-foreground">Veículo não encontrado.</div>;

  const totalPartsCost = parts.reduce((s, p) => s + (p.cost || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/vehicles">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-sm text-muted-foreground">{vehicle.license_plate} · {vehicle.fuel_type}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted rounded-xl p-1 overflow-x-auto scrollbar-none">
        {[
          { id: "timeline", label: `Histórico (${expenses.length})`, icon: CheckCircle2 },
          { id: "parts", label: `Peças (${parts.length})`, icon: Wrench },
          { id: "checklists", label: `Checklists (${checklists.length})`, icon: ClipboardCheck },
          { id: "docs", label: `Docs (${docs.length})`, icon: FileText },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              tab === t.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Timeline Tab */}
      {tab === "timeline" && (
        <MaintenanceTimeline expenses={expenses} vehicle={vehicle} />
      )}

      {/* Parts Tab */}
      {tab === "parts" && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Custo total: <span className="font-semibold text-foreground">€{totalPartsCost.toFixed(2)}</span></p>
              <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => { setEditPart(null); setPartDialog(true); }}>
                <Plus className="w-4 h-4" /> Adicionar Peça
              </Button>
            </div>
            {parts.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/50 rounded-xl border border-border">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">De</label>
                  <input type="date" value={pdfDateFrom} onChange={e => setPdfDateFrom(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input type="date" value={pdfDateTo} onChange={e => setPdfDateTo(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl h-8" onClick={() => {
                  const filtered = parts.filter(p => {
                    if (!p.installation_date) return true;
                    if (pdfDateFrom && p.installation_date < pdfDateFrom) return false;
                    if (pdfDateTo && p.installation_date > pdfDateTo) return false;
                    return true;
                  }).sort((a, b) => (a.installation_date || "") > (b.installation_date || "") ? 1 : -1);
                  const doc = new jsPDF();
                  doc.setFontSize(16);
                  doc.text(`${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`, 14, 18);
                  doc.setFontSize(11);
                  doc.text(`Listagem de Peças/Componentes`, 14, 26);
                  doc.setFontSize(9);
                  const range = pdfDateFrom || pdfDateTo ? ` | ${pdfDateFrom || ""} — ${pdfDateTo || ""}` : "";
                  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-PT")}${range}`, 14, 32);
                  let y = 42;
                  filtered.forEach((p, i) => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFontSize(10); doc.setFont(undefined, "bold");
                    doc.text(`${i + 1}. ${p.name} [${p.category}]`, 14, y);
                    doc.setFont(undefined, "normal"); doc.setFontSize(9);
                    const details = [p.brand ? `Marca: ${p.brand}` : null, p.reference ? `Ref: ${p.reference}` : null, p.installation_date ? `Instalado: ${p.installation_date}` : null, p.installation_mileage ? `${p.installation_mileage.toLocaleString()} km` : null, p.warranty_date ? `Garantia até: ${p.warranty_date}` : null, p.cost ? `Custo: €${p.cost.toFixed(2)}` : null].filter(Boolean).join("  |  ");
                    if (details) { y += 5; doc.text(details, 18, y); }
                    if (p.notes) { y += 5; doc.text(`Notas: ${p.notes}`, 18, y); }
                    y += 8;
                  });
                  doc.save(`pecas-${vehicle.license_plate}.pdf`);
                }}>
                  <Download className="w-4 h-4" /> Exportar PDF
                </Button>
              </div>
            )}
          </div>
          {parts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sem peças registadas.</div>
          ) : (
            <div className="space-y-3">
              {parts.map(part => {
                const isWarrantyExpired = part.warranty_date && isPast(new Date(part.warranty_date));
                const daysToWarranty = part.warranty_date ? differenceInDays(new Date(part.warranty_date), new Date()) : null;
                const warrantyWarning = daysToWarranty !== null && daysToWarranty >= 0 && daysToWarranty <= 30;
                return (
                  <div key={part.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{part.name}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORY_COLORS[part.category] || CATEGORY_COLORS["Outro"])}>
                            {part.category}
                          </span>
                          {(warrantyWarning || isWarrantyExpired) && (
                            <span className={cn("text-xs flex items-center gap-1", isWarrantyExpired ? "text-destructive" : "text-amber-600")}>
                              <AlertTriangle className="w-3 h-3" />
                              {isWarrantyExpired ? "Garantia expirada" : `Garantia: ${daysToWarranty}d`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          {part.brand && <span>🏷️ {part.brand}{part.reference ? ` · ${part.reference}` : ""}</span>}
                          {part.installation_date && <span>📅 {format(new Date(part.installation_date), "d MMM yyyy", { locale: pt })}</span>}
                          {part.installation_mileage && <span>🛣️ {part.installation_mileage.toLocaleString()} km</span>}
                          {part.warranty_date && <span>🛡️ até {format(new Date(part.warranty_date), "d MMM yyyy", { locale: pt })}</span>}
                          {part.next_replacement_km && <span>🔧 próx. aos {part.next_replacement_km.toLocaleString()} km</span>}
                          {part.supplier && <span>🏪 {part.supplier}</span>}
                          {part.cost && <span className="font-medium text-foreground">€{part.cost.toFixed(2)}</span>}
                        </div>
                        {part.notes && <p className="text-xs text-muted-foreground mt-1 italic">{part.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditPart(part); setPartDialog(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePart(part.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === "docs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => { setEditDoc(null); setDocDialog(true); }}>
              <Upload className="w-4 h-4" /> Adicionar Documento
            </Button>
          </div>
          {docs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sem documentos.</div>
          ) : (
            <div className="space-y-3">
              {docs.map(doc => {
                const isImage = doc.file_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_url);
                return (
                  <div key={doc.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category}{doc.date ? ` · ${format(new Date(doc.date), "d MMM yyyy", { locale: pt })}` : ""}
                        </p>
                        {doc.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{doc.notes}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditDoc(doc); setDocDialog(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDoc(doc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {doc.file_url && (
                      <div className="flex gap-2 pt-1">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" className="h-8 w-8" title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </a>
                        <a href={doc.file_url} download target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" className="h-8 w-8" title="Download">
                            <ArrowDownToLine className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    )}
                    {isImage && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <img src={doc.file_url} alt={doc.title} className="w-full max-h-48 object-cover rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Checklists Tab */}
      {tab === "checklists" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Checklists de inspeção pré-viagem</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => exportVehicleXLSX(vehicle, parts, expenses)}>
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => { setEditChecklist(null); setChecklistDialog(true); }}>
                <Plus className="w-4 h-4" /> Nova Checklist
              </Button>
            </div>
          </div>
          {checklists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sem checklists registadas.</div>
          ) : (
            <div className="space-y-3">
              {checklists.map(cl => (
                <ChecklistCard key={cl.id} checklist={cl} onEdit={handleEditChecklist} onDelete={handleDeleteChecklist} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Part Dialog */}
      <Dialog open={partDialog} onOpenChange={(v) => { setPartDialog(v); if (!v) setEditPart(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPart ? "Editar Peça" : "Nova Peça"}</DialogTitle></DialogHeader>
          <PartForm part={editPart} onSave={handleSavePart} onCancel={() => { setPartDialog(false); setEditPart(null); }} />
        </DialogContent>
      </Dialog>

      {/* Checklist Dialog */}
      <Dialog open={checklistDialog} onOpenChange={(v) => { setChecklistDialog(v); if (!v) setEditChecklist(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editChecklist ? "Editar Checklist" : "Nova Checklist"}</DialogTitle></DialogHeader>
          <ChecklistForm vehicle={vehicle} checklist={editChecklist} onSave={handleSaveChecklist} onCancel={() => { setChecklistDialog(false); setEditChecklist(null); }} />
        </DialogContent>
      </Dialog>

      {/* Insurance Dialog */}
      <Dialog open={insuranceDialog} onOpenChange={(v) => { setInsuranceDialog(v); if (!v) setEditInsurance(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editInsurance ? "Editar Seguro" : "Novo Seguro"}</DialogTitle></DialogHeader>
          <InsuranceForm insurance={editInsurance} onSave={handleSaveInsurance} onCancel={() => { setInsuranceDialog(false); setEditInsurance(null); }} />
        </DialogContent>
      </Dialog>

      {/* Doc Dialog */}
      <Dialog open={docDialog} onOpenChange={(v) => { setDocDialog(v); if (!v) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editDoc ? "Editar Documento" : "Novo Documento"}</DialogTitle></DialogHeader>
          <DocumentForm doc={editDoc} onSave={handleSaveDoc} onCancel={() => { setDocDialog(false); setEditDoc(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}