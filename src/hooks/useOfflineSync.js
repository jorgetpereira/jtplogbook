import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { flushQueue, getPendingCount } from '@/lib/offlineQueue';

// ---------------------------------------------------------------------------
// Resto da era em que havia servidor.
//
// Nessa altura, gravar sem rede era impossível, e as páginas desviavam a
// gravação para uma fila em localStorage à espera de melhores dias. Agora a
// base de dados é local e uma gravação nunca falha — mas as páginas ainda
// perguntam "estou online?" antes de gravar, e com a resposta errada punham o
// registo na fila em vez de o guardarem.
//
// Daí o isOnline ficar sempre verdadeiro: para a gravação, estamos sempre.
// A fila mantém-se apenas para esvaziar o que lá tenha ficado preso.
// ---------------------------------------------------------------------------

const ENTITIES = {
  Expense: base44.entities.Expense,
  Charging: base44.entities.Charging,
  Vehicle: base44.entities.Vehicle,
  Notification: base44.entities.Notification,
};

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const refresh = useCallback(() => {
    setPendingCount(getPendingCount());
  }, []);

  // Escreve na base local tudo o que tenha ficado na fila antiga.
  // Já não depende da rede, porque o destino é o próprio aparelho.
  const sync = useCallback(async () => {
    if (getPendingCount() === 0) return;
    setIsSyncing(true);
    try {
      const result = await flushQueue(ENTITIES);
      setLastSyncResult(result);
      setPendingCount(getPendingCount());
    } catch {
      // Se falhar, os registos ficam na fila para a próxima tentativa.
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    sync();
  }, [sync]);

  return { isOnline: true, pendingCount, isSyncing, lastSyncResult, refresh, sync };
}
