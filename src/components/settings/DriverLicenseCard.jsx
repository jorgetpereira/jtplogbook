import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Save, AlertTriangle, CheckCircle2, Camera, Trash2, Loader2 } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function DriverLicenseCard() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({
    license_number: "",
    license_categories: "",
    license_first_issue_date: "",
    license_issue_date: "",
    license_expiry_date: "",
    license_photo_url: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm({
        license_number: u.license_number || "",
        license_categories: u.license_categories || "",
        license_first_issue_date: u.license_first_issue_date || "",
        license_issue_date: u.license_issue_date || "",
        license_expiry_date: u.license_expiry_date || "",
        license_photo_url: u.license_photo_url || "",
      });
    }).catch(() => {});
  }, []);

  const daysToExpiry = form.license_expiry_date
    ? differenceInDays(new Date(form.license_expiry_date + "T12:00:00"), new Date())
    : null;

  const status = !form.license_expiry_date ? null
    : daysToExpiry < 0 ? "expired"
    : daysToExpiry <= 30 ? "warning"
    : "ok";

  const STATUS_CFG = {
    expired: { Icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", label: "Carta expirada" },
    warning: { Icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", label: `Expira em ${daysToExpiry} dias` },
    ok: { Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", label: "Válida" },
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, license_photo_url: file_url }));
    } catch (err) {
      console.error("Failed to upload license photo:", err);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = () => {
    setForm(prev => ({ ...prev, license_photo_url: "" }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        license_number: form.license_number || undefined,
        license_categories: form.license_categories || undefined,
        license_first_issue_date: form.license_first_issue_date || undefined,
        license_issue_date: form.license_issue_date || undefined,
        license_expiry_date: form.license_expiry_date || undefined,
        license_photo_url: form.license_photo_url || undefined,
      });
      setUser(prev => ({ ...prev, ...form }));
      setEditing(false);
    } catch (e) {
      console.error("Failed to save license:", e);
    } finally {
      setSaving(false);
    }
  };

  const cfg = status ? STATUS_CFG[status] : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Carta de Condução</h2>
      </div>

      {!editing ? (
        <>
          {form.license_number || form.license_expiry_date ? (
            <div className="space-y-2">
              {cfg && (
                <div className={cn("flex items-center gap-2 rounded-xl p-2.5 border", cfg.bg, cfg.border)}>
                  <cfg.Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                  <p className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {form.license_number && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Nº Carta</p>
                    <p className="font-medium">{form.license_number}</p>
                  </div>
                )}
                {form.license_categories && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Categorias</p>
                    <p className="font-medium">{form.license_categories}</p>
                  </div>
                )}
                {form.license_first_issue_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">1ª Emissão</p>
                    <p className="font-medium">{format(new Date(form.license_first_issue_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</p>
                  </div>
                )}
                {form.license_issue_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Última Emissão</p>
                    <p className="font-medium">{format(new Date(form.license_issue_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</p>
                  </div>
                )}
                {form.license_expiry_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Validade</p>
                    <p className="font-medium">{format(new Date(form.license_expiry_date + "T12:00:00"), "d MMM yyyy", { locale: pt })}</p>
                  </div>
                )}
              </div>
              {form.license_photo_url && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Foto</p>
                  <img src={form.license_photo_url} alt="Carta de Condução" className="w-full rounded-xl border border-border object-cover max-h-64" />
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setEditing(true)}>
                Editar
              </Button>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-3">Regista a tua carta de condução para receber alertas de renovação.</p>
              <Button size="sm" onClick={() => setEditing(true)}>
                Adicionar Carta
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nº da Carta</Label>
            <Input value={form.license_number} onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))} className="h-9 mt-1" placeholder="ex: P-1234567" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Categorias</Label>
              <Input value={form.license_categories} onChange={e => setForm(p => ({ ...p, license_categories: e.target.value }))} className="h-9 mt-1" placeholder="ex: B" />
            </div>
            <div>
              <Label className="text-xs">1ª Emissão</Label>
              <Input type="date" value={form.license_first_issue_date} onChange={e => setForm(p => ({ ...p, license_first_issue_date: e.target.value }))} className="h-9 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Última Emissão</Label>
              <Input type="date" value={form.license_issue_date} onChange={e => setForm(p => ({ ...p, license_issue_date: e.target.value }))} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Validade</Label>
              <Input type="date" value={form.license_expiry_date} onChange={e => setForm(p => ({ ...p, license_expiry_date: e.target.value }))} className="h-9 mt-1" />
            </div>
          </div>
          {/* Foto da carta */}
          <div>
            <Label className="text-xs">Foto da Carta</Label>
            {form.license_photo_url ? (
              <div className="relative mt-1 rounded-xl overflow-hidden border border-border">
                <img src={form.license_photo_url} alt="Carta de Condução" className="w-full object-cover max-h-64" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="mt-1 w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-colors"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">{uploadingPhoto ? "A carregar..." : "Carregar foto"}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" className="flex-1 gap-1.5" onClick={save} disabled={saving}>
              <Save className="w-3.5 h-3.5" /> {saving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}