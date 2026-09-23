// Offline queue — persists pending create/update/delete operations in localStorage
// and replays them when the network is restored.

const QUEUE_KEY = 'logbook_offline_queue';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(operation) {
  // operation: { id, entity, action, payload, tempId? }
  const queue = getQueue();
  queue.push({ ...operation, id: Date.now() + Math.random() });
  saveQueue(queue);
}

function removeFromQueue(id) {
  const queue = getQueue().filter(op => op.id !== id);
  saveQueue(queue);
}

// Returns count of pending items
export function getPendingCount() {
  return getQueue().length;
}

// Attempts to flush all queued operations. Returns { synced, failed }.
export async function flushQueue(entities) {
  const queue = getQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      const entity = entities[op.entity];
      if (!entity) { removeFromQueue(op.id); synced++; continue; }

      if (op.action === 'create') {
        await entity.create(op.payload);
      } else if (op.action === 'update') {
        await entity.update(op.recordId, op.payload);
      } else if (op.action === 'delete') {
        await entity.delete(op.recordId);
      }
      removeFromQueue(op.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}