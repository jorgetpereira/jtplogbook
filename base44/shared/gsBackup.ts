// Shared Google Sheets backup logic — used by both the manual and scheduled backup functions.

export interface SheetConfig {
  entity: string;
  sheetName: string;
  filter?: Record<string, string>;
}

export function getSheetConfigs(sheets: Record<string, string> | undefined): SheetConfig[] {
  const s = sheets || {};
  return [
    { entity: "Vehicle", sheetName: s.vehicles || "Veículos" },
    { entity: "Expense", sheetName: s.expenses || "Despesas" },
    { entity: "LoanSummary", sheetName: s.loans || "Empréstimos" },
    { entity: "Charging", sheetName: s.chargings || "Carregamentos" },
    { entity: "Notification", sheetName: s.notifications || "Lembretes" },
    { entity: "VehicleIssue", sheetName: s.issuesOpen || "Avarias", filter: { status: "Aberto" } },
    { entity: "VehicleIssue", sheetName: s.issuesResolved || "Histórico", filter: { status: "Resolvido" } },
    { entity: "MaintenanceSchedule", sheetName: s.schedules || "Manutenções km" },
    { entity: "VehiclePart", sheetName: s.parts || "Componentes" },
    { entity: "VehicleDocument", sheetName: s.documents || "Documentos" },
    { entity: "Insurance", sheetName: s.insurances || "Seguros" },
    { entity: "InspectionChecklist", sheetName: s.checklists || "Checklists" },
    { entity: "Location", sheetName: s.locations || "Locais" },
  ];
}

export async function syncEntityToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  records: any[]
): Promise<{ sheet: string; new: number; total: number; error?: string; status?: string }> {
  if (!records || records.length === 0) {
    return { sheet: sheetName, new: 0, total: 0, status: "no_records" };
  }

  const keySet = new Set<string>();
  records.forEach((r) => Object.keys(r).forEach((k) => keySet.add(k)));
  const keys = ["id", ...Array.from(keySet).filter((k) => k !== "id")];
  const sheetRef = `'${sheetName}'`;

  // Check if the sheet exists; create it if not
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURI(sheetRef + "!A1")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (checkRes.status === 400) {
    // Sheet doesn't exist — create it
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      }
    );
  }

  // Clear existing data in the sheet (full rewrite to capture all field changes)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURI(sheetRef + "!A:Z")}:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // Build all rows: header + data
  const allRows = [
    keys,
    ...records.map((r) =>
      keys.map((k) => {
        const val = r[k];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        if (typeof val === "boolean") return val ? "true" : "false";
        return String(val);
      })
    ),
  ];

  // Write header + all records in one go
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURI(sheetRef + "!A1")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: allRows }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    return { sheet: sheetName, new: 0, total: records.length, error: errText };
  }

  return { sheet: sheetName, new: records.length, total: records.length, status: "synced" };
}

// Reads a sheet tab and converts rows to JSON objects using the header row as keys.
export async function readSheetToRecords(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<any[]> {
  const sheetRef = `'${sheetName}'`;
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURI(sheetRef + "!A:Z")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!readRes.ok) return [];

  const sheetData = await readRes.json();
  if (!sheetData.values || sheetData.values.length < 2) return [];

  const headers = sheetData.values[0] as string[];
  return sheetData.values.slice(1).map((row: any[]) => {
    const obj: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      if (h && row[i] !== undefined && row[i] !== "") {
        obj[h] = row[i];
      }
    });
    return obj;
  });
}