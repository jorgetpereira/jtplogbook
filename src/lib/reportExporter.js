import * as XLSX from "xlsx";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  requestAnimationFrame(() => {
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  });
}

function jsonToRows(data) {
  if (!Array.isArray(data) || data.length === 0) return [[]];
  const headers = Object.keys(data[0]).filter(k => k !== "id" && k !== "created_by");
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val == null) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return val;
    })
  );
  return [headers, ...rows];
}

/**
 * Exporta dados simples (array de objetos) para um ficheiro .xlsx com uma sheet.
 */
export function exportToXLSX(data, filename, sheetName = "Dados") {
  const rows = jsonToRows(data);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/**
 * Exporta um workbook com múltiplas sheets.
 * @param {Array<{name: string, data: object[]}>} sheets
 * @param {string} filename
 */
export function exportWorkbookXLSX(sheets, filename) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const rows = jsonToRows(s.data);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

/**
 * Gera um relatório completo em Excel com múltiplas sheets formatadas.
 */
export function exportFullReportXLSX({ vehicles, expenses, chargings, parts, docs, notifications, issues, schedules, insurances, checklists, locations, periodLabel }) {
  const sheets = [
    { name: "Veículos", data: vehicles || [] },
    { name: "Despesas", data: expenses || [] },
    { name: "Carregamentos", data: chargings || [] },
    { name: "Peças", data: parts || [] },
    { name: "Documentos", data: docs || [] },
    { name: "Lembretes", data: notifications || [] },
    { name: "Avarias", data: issues || [] },
    { name: "Manutenções km", data: schedules || [] },
    { name: "Seguros", data: insurances || [] },
    { name: "Checklists", data: checklists || [] },
    { name: "Locais", data: locations || [] },
  ];
  // Sheet de resumo
  const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const totalChargings = (chargings || []).reduce((s, c) => s + (c.total_cost || 0), 0);
  const totalInsurance = (insurances || []).reduce((s, i) => s + (i.premium_amount || 0), 0);
  const summary = [
    { Indicador: "Período", Valor: periodLabel || "Todos" },
    { Indicador: "Nº Veículos", Valor: (vehicles || []).length },
    { Indicador: "Nº Despesas", Valor: (expenses || []).length },
    { Indicador: "Total Despesas (€)", Valor: totalExpenses.toFixed(2) },
    { Indicador: "Nº Carregamentos", Valor: (chargings || []).length },
    { Indicador: "Total Carregamentos (€)", Valor: totalChargings.toFixed(2) },
    { Indicador: "Nº Peças", Valor: (parts || []).length },
    { Indicador: "Nº Documentos", Valor: (docs || []).length },
    { Indicador: "Nº Lembretes", Valor: (notifications || []).length },
    { Indicador: "Nº Avarias", Valor: (issues || []).length },
    { Indicador: "Nº Manutenções km", Valor: (schedules || []).length },
    { Indicador: "Nº Seguros", Valor: (insurances || []).length },
    { Indicador: "Total Seguros (€)", Valor: totalInsurance.toFixed(2) },
    { Indicador: "Nº Checklists", Valor: (checklists || []).length },
    { Indicador: "Nº Locais", Valor: (locations || []).length },
  ];
  sheets.unshift({ name: "Resumo", data: summary });
  exportWorkbookXLSX(sheets, `relatorio-logbook-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/**
 * Exporta dados de um único veículo (peças, despesas) para Excel.
 */
export function exportVehicleXLSX(vehicle, parts, expenses) {
  const sheets = [
    { name: "Peças", data: parts || [] },
    { name: "Despesas", data: expenses || [] },
  ];
  exportWorkbookXLSX(sheets, `${vehicle.brand}-${vehicle.model}-${vehicle.license_plate}.xlsx`);
}