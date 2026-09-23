import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, ShieldAlert, Settings2, Loader2, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import {
  getBackupSettings,
  saveBackupSettings,
  getBackupState,
  isBackupDue,
  runAutoBackup,
  shareBackup,
} from "@/lib/backup";

// Substitui o antigo aviso de "Online · sincronizado", que media apenas a
// ligação à internet e já não dizia nada de útil: os dados estão no aparelho,
// o que interessa saber é quando foi a última cópia de segurança.
export default function BackupBanner() {
  const [state, setState] = useState(() => getBackupState());
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [endpoint, setEndpoint] = useState(() => getBackupSettings().endpoint);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refresh = useCallback(() => setState(getBackupState()), []);

  useEffect(() => {
    window.addEventListener("logbookBackupChanged", refresh);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("logbookBackupChanged", refresh);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  // Tenta a cópia automática ao abrir a app.
  useEffect(() => {
    runAutoBackup().then(refresh);
  }, [refresh]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await shareBackup();
      toast.success("Cópia de segurança guardada");
    } catch (err) {
      if (err?.name !== "AbortError") toast.error("Não foi possível guardar a cópia");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const handleSaveEndpoint = async () => {
    saveBackupSettings({ endpoint: endpoint.trim() });
    setShowSettings(false);
    toast.success(endpoint.trim() ? "Destino guardado" : "Destino removido");
    if (endpoint.trim()) {
      setBusy(true);
      const result = await runAutoBackup({ force: true });
      setBusy(false);
      refresh();
      if (result?.ok) toast.success("Cópia enviada para o Drive");
      else if (result?.error) toast.error(`Falhou: ${result.error}`);
    }
  };

  const due = isBackupDue();
  const failed = state && !state.ok;
  const alert = due || failed;

  const tone = alert
    ? {
        wrap: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
        chip: "bg-amber-100 dark:bg-amber-900/50",
        icon: "text-amber-600 dark:text-amber-400",
        title: "text-amber-800 dark:text-amber-200",
        text: "text-amber-700 dark:text-amber-300",
      }
    : {
        wrap: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
        chip: "bg-green-100 dark:bg-green-900/40",
        icon: "text-green-600 dark:text-green-400",
        title: "text-green-800 dark:text-green-200",
        text: "text-green-700 dark:text-green-300",
      };

  const Icon = alert ? ShieldAlert : ShieldCheck;

  let title = "Cópia de segurança em dia";
  let detail = "";

  if (!state) {
    title = "Ainda sem cópia de segurança";
    detail = "Os registos existem só neste aparelho";
  } else if (failed) {
    title = "A última cópia falhou";
    detail = state.error || "Guarde uma cópia manualmente";
  } else {
    const ago = formatDistanceToNow(new Date(state.at), { locale: pt, addSuffix: true });
    title = due ? "Cópia de segurança em atraso" : "Cópia de segurança em dia";
    detail = `Última ${ago}`;
  }

  return (
    <div className={`rounded-2xl border ${tone.wrap} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className={`shrink-0 w-8 h-8 rounded-xl ${tone.chip} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${tone.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${tone.title}`}>{title}</p>
          <p className={`text-xs ${tone.text} truncate`}>
            {detail}
            {!isOnline && (
              <span className="inline-flex items-center gap-1 ml-2 opacity-70">
                <WifiOff className="w-3 h-3" /> sem rede
              </span>
            )}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={busy}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar"}
        </button>

        <button
          onClick={() => setShowSettings((v) => !v)}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
          aria-label="Configurar destino da cópia"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="px-4 py-3 border-t border-black/5 dark:border-white/10 space-y-2">
          <p className="text-xs text-muted-foreground">
            Endereço do Apps Script no teu Google Drive. Deixa vazio para guardares as cópias só à mão.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://script.google.com/.../exec"
              className="flex-1 min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-xs"
            />
            <button
              onClick={handleSaveEndpoint}
              className="shrink-0 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-transform"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
