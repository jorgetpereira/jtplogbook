// Envio de documentos para o Drive, através do mesmo Apps Script que recebe
// as cópias de segurança. O registo passa a guardar apenas o endereço, em vez
// de levar o ficheiro inteiro dentro de si.

import { getBackupSettings } from '@/lib/backupSettings';

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function driveUploadAvailable() {
  const { endpoint, documentsToDrive } = getBackupSettings();
  return Boolean(endpoint) && documentsToDrive !== false && navigator.onLine;
}

export async function uploadToDrive(file) {
  const { endpoint } = getBackupSettings();
  if (!endpoint) throw new Error('Sem destino configurado');
  if (!navigator.onLine) throw new Error('Sem ligação à internet');

  const base64 = await toBase64(file);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'upload',
      filename: file.name || 'documento',
      mimeType: file.type || 'application/octet-stream',
      base64,
    }),
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`O destino respondeu ${res.status}`);

  const body = await res.json();
  if (!body?.ok || !body?.url) throw new Error(body?.error || 'Resposta inesperada');

  return { file_url: body.url, view_url: body.view, drive_id: body.id };
}
