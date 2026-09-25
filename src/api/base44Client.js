// ---------------------------------------------------------------------------
// Cliente local — substitui o SDK do Base44.
//
// Mantém exactamente a mesma forma que o SDK expunha (base44.entities.X.list,
// base44.auth.me, base44.integrations.Core.UploadFile, base44.functions.invoke),
// mas servida pelo IndexedDB do próprio aparelho. É por isso que os 42
// ficheiros que falam com o "base44" não precisaram de ser alterados.
// ---------------------------------------------------------------------------

import {
  ENTITIES,
  createEntity,
  getLocalUser,
  updateLocalUser,
  storeFile,
} from './localDb';
import { driveUploadAvailable, uploadToDrive } from '@/lib/driveFiles';

const entities = {};
for (const name of ENTITIES) {
  entities[name] = createEntity(name);
}

// Funções que corriam no backend do Base44 e ainda não têm substituto local.
// Falham com uma mensagem clara em vez de silenciosamente não fazerem nada.
const UNAVAILABLE = {
  getDGEGPrices: 'Preços da DGEG',
  getFuelPriceHistory: 'Histórico de preços dos combustíveis',
  getNearbyStations: 'Postos de combustível por perto',
  getNearbyEVStations: 'Postos de carregamento por perto',
  backupToGoogleSheets: 'Backup para o Google Sheets',
  importFromGoogleSheets: 'Importação do Google Sheets',
  scheduledGSheetsBackup: 'Backup automático para o Google Sheets',
  sendMonthlyReport: 'Resumo mensal por email',
  sendMaintenanceEmail: 'Aviso de manutenção por email',
  sendMaintenanceAlertGmail: 'Alerta de manutenção por Gmail',
  syncCalendarEvent: 'Sincronização com o Google Calendar',
  checkMaintenanceReminders: 'Verificação de manutenções',
  createMonthlyLoanPayment: 'Pagamento mensal de crédito',
  updateMaintenanceInfo: 'Actualização de manutenção',
};

function unavailable(label) {
  const err = new Error(
    `${label}: esta funcionalidade ainda não está disponível na versão local.`
  );
  err.code = 'LOCAL_UNAVAILABLE';
  return err;
}

export const base44 = {
  entities,

  auth: {
    me: () => getLocalUser(),
    updateMe: (data) => updateLocalUser(data),
    isAuthenticated: () => true,
    logout: () => Promise.resolve(),
    redirectToLogin: () => {},
  },

  integrations: {
    Core: {
      // Com destino configurado e rede, o documento vai para o Drive e o
      // registo guarda só o endereço. Sem uma coisa ou outra, fica guardado
      // dentro do próprio registo, como antes — nunca se perde o ficheiro.
      UploadFile: async ({ file }) => {
        if (driveUploadAvailable()) {
          try {
            return await uploadToDrive(file);
          } catch {
            // Cai para o armazenamento local em silêncio.
          }
        }
        return storeFile(file);
      },
      InvokeLLM: () => Promise.reject(unavailable('Leitura automática de talões')),
    },
  },

  functions: {
    // Resolve em vez de rejeitar: as funcionalidades que corriam no servidor
    // simplesmente não devolvem dados, e a página segue o seu caminho. A
    // rejeição fazia páginas inteiras rebentar por causa de um extra.
    invoke: (name) =>
      Promise.resolve({
        data: null,
        unavailable: true,
        reason: UNAVAILABLE[name] || name,
      }),
  },
};

export default base44;
