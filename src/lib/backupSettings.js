// Definições e estado das cópias de segurança.
//
// Vive num ficheiro próprio, sem importar nada, porque é preciso tanto na
// camada de dados (para enviar documentos ao Drive) como na biblioteca de
// cópias — e se ambas importassem a outra, teríamos um ciclo.

const SETTINGS_KEY = 'logbook_backup_settings';
const STATE_KEY = 'logbook_backup_state';

const DEFAULT_SETTINGS = {
  endpoint: '',        // endereço do Apps Script (termina em /exec)
  intervalDays: 2,
  documentsToDrive: true,
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

export function setBackupState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('logbookBackupChanged'));
  return state;
}
