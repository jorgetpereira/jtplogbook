import { WifiOff, RefreshCw, CloudUpload, Wifi, CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export default function OfflineSyncBanner() {
  const { isOnline, pendingCount, isSyncing, sync } = useOfflineSync();
  const [gsStatus, setGsStatus] = useState(null);

  const loadGsStatus = async () => {
    try {
      const user = await base44.auth.me();
      if (!user?.sheets_backup_url) {
        setGsStatus({ state: null });
        return;
      }
      const lastStatus = user.sheets_backup_last_status;
      const lastDate = user.sheets_backup_last_date;
      if (!lastStatus) {
        setGsStatus({ state: "agendado" });
      } else if (lastStatus === "error" || lastStatus === "partial") {
        setGsStatus({ state: "falha", date: lastDate });
      } else {
        setGsStatus({ state: "atualizado", date: lastDate });
      }
    } catch {
      setGsStatus({ state: null });
    }
  };

  useEffect(() => {
    loadGsStatus();
    const handler = () => loadGsStatus();
    window.addEventListener("gsheetsBackupDone", handler);
    return () => window.removeEventListener("gsheetsBackupDone", handler);
  }, []);

  const gsConfig = {
    atualizado: { Icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", label: "Sheets atualizado" },
    agendado: { Icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", label: "Sheets agendado" },
    falha: { Icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", label: "Sheets: falha" },
  };

  const renderGsHalf = () => {
    if (!gsStatus?.state) return null;
    const c = gsConfig[gsStatus.state];
    if (!c) return null;
    const { Icon } = c;
    return (
      <>
        <div className="w-px self-stretch bg-green-200 dark:bg-green-800 shrink-0" />
        <div className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0">
          <div className={`shrink-0 w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${c.color}`} />
          </div>
          <p className={`text-xs font-medium ${c.color} truncate`}>
            {c.label}
            {gsStatus.date && (
              <span className="text-muted-foreground font-normal">
                {" - "}{format(new Date(gsStatus.date), "d MMM HH:mm", { locale: pt })}
              </span>
            )}
          </p>
        </div>
      </>
    );
  };

  // Online, no pending, not syncing — stacked in 2 lines with GSheets status
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return (
      <div className="flex flex-col bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 min-w-0">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <Wifi className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xs font-medium text-green-700 dark:text-green-300 truncate">Online · sincronizado</p>
        </div>
        {gsStatus?.state && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-green-200 dark:border-green-800 min-w-0">
            <div className={`shrink-0 w-7 h-7 rounded-lg ${gsConfig[gsStatus.state].bg} flex items-center justify-center`}>
              {(() => {
                const GsIcon = gsConfig[gsStatus.state].Icon;
                return <GsIcon className={`w-3.5 h-3.5 ${gsConfig[gsStatus.state].color}`} />;
              })()}
            </div>
            <p className={`text-xs font-medium ${gsConfig[gsStatus.state].color} truncate`}>
              {gsConfig[gsStatus.state].label}
              {gsStatus.date && (
                <span className="text-muted-foreground font-normal">
                  {" - "}{format(new Date(gsStatus.date), "d MMM HH:mm", { locale: pt })}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
        <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Modo Offline</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {pendingCount > 0
              ? `${pendingCount} registo${pendingCount > 1 ? "s" : ""} guardado${pendingCount > 1 ? "s" : ""} · sincroniza ao recuperar rede`
              : "Os registos serão sincronizados ao recuperar rede"}
          </p>
        </div>
      </div>
    );
  }

  // Syncing
  if (isSyncing) {
    return (
      <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3">
        <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">A sincronizar...</p>
          <p className="text-xs text-muted-foreground">{pendingCount} registo{pendingCount > 1 ? "s" : ""} a enviar</p>
        </div>
      </div>
    );
  }

  // Online with pending items
  return (
    <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
      <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
        <CloudUpload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {pendingCount} registo{pendingCount > 1 ? "s" : ""} por sincronizar
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">Prima para enviar agora</p>
      </div>
      <button
        onClick={sync}
        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-95 transition-transform"
      >
        Sincronizar
      </button>
    </div>
  );
}