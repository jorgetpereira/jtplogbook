import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineStatusBar() {
  const { isOnline, pendingCount, isSyncing, lastSyncResult, sync } = useOfflineSync();

  // Online and nothing pending — hide
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-medium py-1.5 px-4">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          Modo offline
          {pendingCount > 0 ? ` · ${pendingCount} registo${pendingCount > 1 ? 's' : ''} por sincronizar` : ''}
        </span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-medium py-1.5 px-4">
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>A sincronizar {pendingCount} registo{pendingCount > 1 ? 's' : ''}…</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-medium py-1.5 px-4">
        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
        <span>{pendingCount} registo{pendingCount > 1 ? 's' : ''} por sincronizar</span>
        <button onClick={sync} className="underline ml-1">Sincronizar agora</button>
      </div>
    );
  }

  return null;
}