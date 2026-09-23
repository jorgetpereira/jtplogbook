// ---------------------------------------------------------------------------
// Camada de dados local (IndexedDB).
//
// Substitui o backend do Base44. Os dados vivem no aparelho e são a fonte da
// verdade: a app lê e escreve sempre aqui, com rede ou sem ela. Não há
// sincronização nem fila de pendentes, porque não há servidor do outro lado.
//
// Sem dependências novas — IndexedDB puro, que todos os browsers têm.
// ---------------------------------------------------------------------------

const DB_NAME = 'logbook';
const DB_VERSION = 1;

export const ENTITIES = [
  'Vehicle',
  'Expense',
  'Charging',
  'Location',
  'Notification',
  'MaintenanceSchedule',
  'Insurance',
  'InspectionChecklist',
  'VehicleDocument',
  'VehicleIssue',
  'VehiclePart',
];

const META_STORE = '_meta';
const ALL_STORES = [...ENTITIES, META_STORE];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ALL_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

// Envolve um pedido do IndexedDB numa promessa.
function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// Ordenação no formato do Base44: "campo" ascendente, "-campo" descendente.
function sortRecords(rows, sort) {
  if (!sort) return rows;

  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;

  return rows.sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];

    // Registos sem valor vão sempre para o fim, seja qual for a direção.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    let r;
    if (typeof av === 'number' && typeof bv === 'number') {
      r = av - bv;
    } else {
      r = String(av).localeCompare(String(bv), 'pt', { numeric: true });
    }

    return desc ? -r : r;
  });
}

// Igualdade simples, como a do Base44: { campo: valor } e todos têm de bater.
function matches(row, query) {
  for (const [key, value] of Object.entries(query || {})) {
    const cur = row?.[key];
    if (cur === value) continue;
    if (cur == null || value == null) return false;
    if (String(cur) !== String(value)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// API por entidade — a mesma assinatura que o SDK do Base44 expunha,
// para que o resto da app não precise de mudar.
// ---------------------------------------------------------------------------

export function createEntity(name) {
  async function readAll() {
    return (await withStore(name, 'readonly', (store) => wrap(store.getAll()))) || [];
  }

  return {
    async list(sort, limit) {
      const rows = sortRecords(await readAll(), sort);
      return limit ? rows.slice(0, limit) : rows;
    },

    async filter(query, sort, limit) {
      const rows = sortRecords((await readAll()).filter((r) => matches(r, query)), sort);
      return limit ? rows.slice(0, limit) : rows;
    },

    async get(id) {
      const row = await withStore(name, 'readonly', (store) => wrap(store.get(id)));
      if (!row) {
        const err = new Error(`${name} ${id} não encontrado`);
        err.status = 404;
        throw err;
      }
      return row;
    },

    async create(data) {
      const record = {
        ...data,
        id: data?.id || newId(),
        created_date: data?.created_date || nowIso(),
        updated_date: nowIso(),
      };
      await withStore(name, 'readwrite', (store) => store.put(record));
      return record;
    },

    async update(id, data) {
      const existing = await withStore(name, 'readonly', (store) => wrap(store.get(id)));
      const record = {
        ...(existing || {}),
        ...data,
        id,
        created_date: existing?.created_date || nowIso(),
        updated_date: nowIso(),
      };
      await withStore(name, 'readwrite', (store) => store.put(record));
      return record;
    },

    async delete(id) {
      await withStore(name, 'readwrite', (store) => store.delete(id));
      return { success: true };
    },

    async bulkCreate(items) {
      const records = (items || []).map((data) => ({
        ...data,
        id: data?.id || newId(),
        created_date: data?.created_date || nowIso(),
        updated_date: nowIso(),
      }));
      await withStore(name, 'readwrite', (store) => {
        for (const record of records) store.put(record);
      });
      return records;
    },
  };
}

// ---------------------------------------------------------------------------
// Perfil do utilizador — guardado localmente, sem contas nem servidor.
// ---------------------------------------------------------------------------

const USER_KEY = 'user';

const DEFAULT_USER = {
  id: USER_KEY,
  full_name: '',
  email: '',
  role: 'admin',
};

export async function getLocalUser() {
  const stored = await withStore(META_STORE, 'readonly', (store) => wrap(store.get(USER_KEY)));
  if (stored) return stored;

  await withStore(META_STORE, 'readwrite', (store) => store.put(DEFAULT_USER));
  return { ...DEFAULT_USER };
}

export async function updateLocalUser(data) {
  const current = await getLocalUser();
  const merged = { ...current, ...data, id: USER_KEY };
  await withStore(META_STORE, 'readwrite', (store) => store.put(merged));
  return merged;
}

// ---------------------------------------------------------------------------
// Ficheiros — guardados como data URL dentro do próprio registo, para que
// as imagens e os PDFs continuem a abrir sem servidor nenhum.
// As fotografias são reduzidas antes de guardar, senão ocupavam um disparate.
// ---------------------------------------------------------------------------

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function shrinkImage(file) {
  const dataUrl = await readAsDataUrl(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('imagem ilegível'));
      el.src = dataUrl;
    });

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    if (scale >= 1) return dataUrl;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    // Se algo correr mal a reduzir, guarda o original.
    return dataUrl;
  }
}

export async function storeFile(file) {
  if (!file) throw new Error('Nenhum ficheiro indicado');

  const isImage = (file.type || '').startsWith('image/');
  const dataUrl = isImage ? await shrinkImage(file) : await readAsDataUrl(file);

  return { file_url: dataUrl, name: file.name, type: file.type };
}

// ---------------------------------------------------------------------------
// Manutenção: apagar tudo (usado pela importação de backup, se precisar).
// ---------------------------------------------------------------------------

export async function clearAll() {
  for (const name of ENTITIES) {
    await withStore(name, 'readwrite', (store) => store.clear());
  }
}
