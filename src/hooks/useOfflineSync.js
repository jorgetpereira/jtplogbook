import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { flushQueue, getPendingCount } from '@/lib/offlineQueue';

const ENTITIES = {
  Expense: base44.entities.Expense,
  Charging: base44.entities.Charging,
  Vehicle: base44.entities.Vehicle,
  Notification: base44.entities.Notification,
};

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refresh = useCallback(() => {
    setPendingCount(getPendingCount());
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || getPendingCount() === 0) return;
    setIsSyncing(true);
    try {
      const result = await flushQueue(ENTITIES);
      setLastSyncResult(result);
      setPendingCount(getPendingCount());
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      sync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [sync]);

  return { isOnline, pendingCount, isSyncing, lastSyncResult, refresh, sync };
}