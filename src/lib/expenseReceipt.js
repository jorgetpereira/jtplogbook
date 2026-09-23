import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

/**
 * Gera um PDF formatado como comprovativo de despesa.
 * @param {object} expense - O registo de despesa
 * @param {object} vehicle - O veículo associado (opcional)
 */
export function generateExpensePDF(expense, vehicle) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Header ──
  doc.setFillColor(79, 110, 247); // primary blue
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Comprovativo de Despesa", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("O meu LogBook", margin, 19);
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: pt })}`, pageW - margin, 19, { align: "right" });

  y = 34;

  // ── Vehicle info ──
  if (vehicle) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text("VEÍCULO", margin, y);
    y += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const vehName = `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "—";
    doc.text(vehName, margin, y);
    if (vehicle.license_plate) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(vehicle.license_plate, pageW - margin, y, { align: "right" });
    }
    y += 6;
  }

  // ── Separator ──
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Expense fields ──
  const isElectric = expense.sub_category === "Eletricidade";
  const isFuel = expense.category === "Combustível";

  const rows = [
    { label: "Categoria", value: expense.category || "—" },
    { label: "Subcategoria", value: expense.sub_category || "—" },
    { label: "Data", value: expense.date ? format(new Date(expense.date + "T12:00:00"), "d/MM/yyyy", { locale: pt }) : "—" },
    { label: "Valor", value: `€${Number(expense.amount || 0).toFixed(2)}` },
  ];

  if (expense.location) rows.push({ label: "Local", value: expense.location });
  if (expense.mileage_at_expense) rows.push({ label: "Quilometragem", value: `${expense.mileage_at_expense.toLocaleString("pt")} km` });
  if (expense.liters) rows.push({ label: isElectric ? "Energia" : "Litros", value: `${expense.liters} ${isElectric ? "kWh" : "L"}` });
  if (expense.price_per_unit) rows.push({ label: "Preço por unidade", value: `€${Number(expense.price_per_unit).toFixed(3)}/${isElectric ? "kWh" : "L"}` });
  if (isFuel && expense.full_tank != null) rows.push({ label: "Depósito", value: expense.full_tank ? "Cheio" : "Parcial" });
  if (expense.tank_percentage) rows.push({ label: "% abastecido", value: `${expense.tank_percentage}%` });
  if (expense.maintenance_type) rows.push({ label: "Tipo de manutenção", value: expense.maintenance_type });
  if (expense.car_avg_consumption) rows.push({ label: "Média do carro", value: `${expense.car_avg_consumption} ${isElectric ? "kWh/100km" : "L/100km"}` });
  if (expense.description) rows.push({ label: "Descrição", value: expense.description });

  // Render rows
  doc.setFontSize(9);
  for (const row of rows) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 16;
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7.5);
    doc.text(row.label.toUpperCase(), margin, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(row.value, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  }

  y += 2;

  // ── Total box ──
  if (y > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    y = 16;
  }
  doc.setFillColor(240, 244, 255);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text("TOTAL", margin + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 110, 247);
  doc.setFontSize(14);
  doc.text(`€${Number(expense.amount || 0).toFixed(2)}`, pageW - margin - 4, y + 9, { align: "right" });
  y += 20;

  // ── Footer ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text("Documento gerado automaticamente por O meu LogBook", margin, pageH - 7);
  doc.text(format(new Date(), "d/MM/yyyy 'às' HH:mm", { locale: pt }), pageW - margin, pageH - 7, { align: "right" });

  // ── Save ──
  const plate = vehicle?.license_plate ? `_${vehicle.license_plate.replace(/\s+/g, "")}` : "";
  const dateStr = expense.date ? `_${expense.date}` : "";
  doc.save(`comprovativo${plate}${dateStr}.pdf`);
}