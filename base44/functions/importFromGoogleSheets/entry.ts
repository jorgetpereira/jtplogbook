import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getSheetConfigs, readSheetToRecords } from '../../shared/gsBackup.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { spreadsheet_id, sheets } = body;

    if (!spreadsheet_id) return Response.json({ error: 'ID da spreadsheet em falta' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const configs = getSheetConfigs(sheets);

    const result = {};
    const summary = [];

    for (const config of configs) {
      try {
        // LoanSummary is a computed view, not a real entity — skip during import
        if (config.entity === "LoanSummary") {
          summary.push({ sheet: config.sheetName, entity: config.entity, count: 0, skipped: true });
          continue;
        }
        const records = await readSheetToRecords(accessToken, spreadsheet_id, config.sheetName);
        if (records.length > 0) {
          if (!result[config.entity]) result[config.entity] = [];
          result[config.entity].push(...records);
          summary.push({ sheet: config.sheetName, entity: config.entity, count: records.length });
        } else {
          summary.push({ sheet: config.sheetName, entity: config.entity, count: 0 });
        }
      } catch (e) {
        summary.push({ sheet: config.sheetName, entity: config.entity, count: 0, error: e.message });
      }
    }

    return Response.json({ success: true, data: result, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}