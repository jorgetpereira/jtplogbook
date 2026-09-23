// ---------------------------------------------------------------------------
// Cópias de segurança.
//
// Os dados vivem no aparelho, por isso a cópia deixou de ser um extra e passou
// a ser a única rede de segurança. Isto trata de três coisas:
//   • juntar tudo num JSON igual ao que a página Importar/Exportar produz;
//   • enviá-lo sozinho para o Google Drive, através de um Apps Script teu;
//   • quando isso não é possível, avisar e deixar guardar com um toque.
// ---------------------------------------------------------------------------

import { base44 } from '@/api/base44Client';

const SETTINGS_KEY = 'logbook_backup_settings';
const STATE_KEY = 'logbook_backup_state';

const DEFAULT_SETTINGS = {
  endpoint: '',      // endereço do Apps Script (termina em /exec)
  intervalDays: 2,
};

export function getBackupSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveBackupSettings(patch) {
  const next = { ...getBackupSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

// Estado da última cópia: { at, ok, method, error }
export function getBackupState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
  } catch {
    return null;
  }
}

function setBackupState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('logbookBackupChanged'));
  return state;
}

export function daysSinceBackup() {
  const state = getBackupState();
  if (!state?.at || !state.ok) return Infinity;
  return (Date.now() - new Date(state.at).getTime()) / 86400000;
}

export function isBackupDue() {
  return daysSinceBackup() >= getBackupSettings().intervalDays;
}

// ---------------------------------------------------------------------------
// Recolha dos dados — mesmas chaves que a importação espera, para que um
// ficheiro destes possa ser restaurado tal e qual na página Importar/Exportar.
// ---------------------------------------------------------------------------

export async function collectBackup() {
  const [
    vehicles, expenses, parts, docs, notifications,
    chargings, issues, schedules, insurances, checklists, locations,
  ] = await Promise.all([
    base44.entities.Vehicle.list(),
    base44.entities.Expense.list('-date'),
    base44.entities.VehiclePart.list(),
    base44.entities.VehicleDocument.list(),
    base44.entities.Notification.list(),
    base44.entities.Charging.list('-start_datetime'),
    base44.entities.VehicleIssue.list(),
    base44.entities.MaintenanceSchedule.list(),
    base44.entities.Insurance.list(),
    base44.entities.InspectionChecklist.list(),
    base44.entities.Location.list('name'),
  ]);

  return {
    vehicles, expenses, parts, docs, notifications,
    chargings, issues, schedules, insurances, checklists, locations,
  };
}

export function backupFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `logbook-${stamp}.json`;
}

// ---------------------------------------------------------------------------
// Envio para o Drive, via Apps Script.
//
// O corpo vai como texto simples de propósito: assim o browser não faz o
// pedido de verificação prévia, que o Apps Script não sabe responder.
// ---------------------------------------------------------------------------

export async function sendToDrive(payload) {
  const { endpoint } = getBackupSettings();
  if (!endpoint) throw new Error('Sem endereço de destino configurado');
  if (!navigator.onLine) throw new Error('Sem ligação à internet');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ filename: backupFilename(), data: payload }),
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`O destino respondeu ${res.status}`);
  return true;
}

// ---------------------------------------------------------------------------
// Guardar no aparelho: usa a folha de partilha no telemóvel (Drive, email,
// o que quiseres) e o descarregamento normal no computador.
// ---------------------------------------------------------------------------

export async function shareBackup() {
  const payload = await collectBackup();
  const text = JSON.stringify(payload, null, 2);
  const name = backupFilename();

  const file = new File([text], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cópia do Logbook' });
      setBackupState({ at: new Date().toISOString(), ok: true, method: 'partilha' });
      return 'partilha';
    } catch (err) {
      // O utilizador cancelou a partilha — não conta como cópia feita.
      if (err?.name === 'AbortError') throw err;
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);

  setBackupState({ at: new Date().toISOString(), ok: true, method: 'ficheiro' });
  return 'ficheiro';
}

// ---------------------------------------------------------------------------
// Cópia automática: corre ao abrir a app, e só faz alguma coisa se já
// passaram os dias combinados e houver destino configurado.
// ---------------------------------------------------------------------------

export async function runAutoBackup({ force = false } = {}) {
  const { endpoint } = getBackupSettings();
  if (!endpoint) return { skipped: 'sem-destino' };
  if (!force && !isBackupDue()) return { skipped: 'recente' };
  if (!navigator.onLine) return { skipped: 'offline' };

  try {
    const payload = await collectBackup();
    await sendToDrive(payload);
    setBackupState({ at: new Date().toISOString(), ok: true, method: 'drive' });
    return { ok: true };
  } catch (err) {
    setBackupState({
      at: new Date().toISOString(),
      ok: false,
      method: 'drive',
      error: err?.message || 'falhou',
    });
    return { ok: false, error: err?.message };
  }
}
