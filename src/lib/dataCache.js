// Simple localStorage cache for offline data persistence.
// On successful API load: save data. On failure: restore from cache.

const PREFIX = 'logbook_cache_';

export function saveCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
}

export function loadCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}