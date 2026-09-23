import { useState, useEffect } from "react";
import { Sun, Moon, SunMoon, Trash2, SettingsIcon, AlertTriangle, MapPin, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import LocationsManager from "@/components/settings/LocationsManager";
import DriverLicenseCard from "@/components/settings/DriverLicenseCard";

export default function Settings() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null); // null=checking, true=ok, false=error

  useEffect(() => {
    base44.functions.invoke("sendMonthlyReport", { dry_run: true })
      .then(() => setGmailStatus(true))
      .catch(() => setGmailStatus(false));
  }, []);

  const changeTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    window.dispatchEvent(new Event('themechange'));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    // Request account deletion then logout
    try {
      await base44.auth.logout();
    } catch {
      await base44.auth.logout();
    }
  };

  const openConfirm = () => { setConfirmStep(1); setConfirmOpen(true); };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-br from-zinc-600 to-neutral-700 text-white px-4 pb-4 sticky top-0 z-20 shadow-lg shadow-zinc-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 opacity-80" />
          Definições
        </h1>
      </div>
      <div className="max-w-lg mx-auto w-full px-4 pb-6 space-y-8">
      {/* Theme */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Aparência</h2>
        <div className="flex rounded-xl border border-border overflow-hidden">
          {[
            { value: 'light', label: 'Diurno', Icon: Sun },
            { value: 'auto', label: 'Automático', Icon: SunMoon },
            { value: 'dark', label: 'Noturno', Icon: Moon },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => changeTheme(value)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 text-xs font-medium transition-colors ${
                theme === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Driver License */}
      <DriverLicenseCard />

      {/* Locations */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Os Meus Locais</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Crie a sua lista de locais para usar ao registar despesas.</p>
        <LocationsManager />
      </div>

      {/* Integrações */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Integrações</h2>
        </div>
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
              <Mail className="w-5 h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Gmail</p>
              <p className="text-xs text-muted-foreground">Resumos mensais e alertas de manutenção</p>
            </div>
          </div>
          <div className="shrink-0">
            {gmailStatus === null && (
              <span className="text-xs text-muted-foreground">A verificar...</span>
            )}
            {gmailStatus === true && (
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Ativo
              </div>
            )}
            {gmailStatus === false && (
              <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                Inativo
              </div>
            )}
          </div>
        </div>
        {gmailStatus === false && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
            O envio de emails não está ativo de momento.
          </div>
        )}
        {gmailStatus === true && (
          <div className="text-xs text-muted-foreground">
            ✅ Resumo mensal enviado automaticamente no dia 1 de cada mês.<br />
            🔔 Alertas de manutenção enviados diariamente quando necessário.
          </div>
        )}
      </div>

      {/* Account */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Conta</h2>
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive gap-2"
          onClick={openConfirm}
        >
          <Trash2 className="w-4 h-4" />
          Eliminar Conta
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setConfirmStep(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Eliminar Conta
            </DialogTitle>
          </DialogHeader>
          {confirmStep === 1 ? (
            <>
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">⚠️ Atenção: Esta ação é irreversível!</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Todos os seus veículos serão eliminados</li>
                  <li>Todas as despesas e manutenções serão eliminadas</li>
                  <li>Todos os documentos e peças serão eliminados</li>
                  <li>Não é possível recuperar os dados</li>
                </ul>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => setConfirmStep(2)}>Continuar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Para confirmar, prima o botão abaixo. A sua sessão será terminada e os seus dados eliminados.</p>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmStep(1)}>Voltar</Button>
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? "A eliminar..." : "🗑️ Eliminar permanentemente"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}