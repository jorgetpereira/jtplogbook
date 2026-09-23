import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Download, X, FileSpreadsheet } from "lucide-react";
import { saveCache, loadCache } from "@/lib/dataCache";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartMeasureContext } from "../components/reports/ChartWrapper";
import { format as formatDate } from "date-fns";
import { pt } from "date-fns/locale";
import ReportByCategory from "../components/reports/ReportByCategory";
import ReportByVehicle from "../components/reports/ReportByVehicle";
import ReportTimeline from "../components/reports/ReportTimeline";
import ReportYearComparison from "../components/reports/ReportYearComparison";
import ReportFuelStats from "../components/reports/ReportFuelStats";
import ReportFuelHistoryTable from "../components/reports/ReportFuelHistoryTable";
import ReportTopExpenses from "../components/reports/ReportTopExpenses";
import ReportMaintenanceReminder from "../components/reports/ReportMaintenanceReminder";
import ReportCostPerKm from "../components/reports/ReportCostPerKm";
import ReportCostPerKmSavings from "../components/reports/ReportCostPerKmSavings";
import ReportFuelCostComparison from "../components/reports/ReportFuelCostComparison";
import ReportForecast from "../components/reports/ReportForecast";
import ReportMonthly from "../components/reports/ReportMonthly";
import ReportEREV from "../components/reports/ReportEREV";
import FuelPriceHistoryChart from "../components/stations/FuelPriceHistoryChart";
import { exportFullReportXLSX } from "@/lib/reportExporter";

export default function Reports() {
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [chargings, setChargings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [renderTick, setRenderTick] = useState(0);
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [costCategories, setCostCategories] = useState({ fuel: true, electric: true, maintenance: true, insurance: true, loan: true });
  const reportRef = useRef(null);

  const exportPDF = async () => {
    setExporting(true);
    const el = reportRef.current;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;
    const imgH = (canvas.height * imgW) / canvas.width;
    let y = 10;
    let remaining = imgH;
    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 10, y, imgW, imgH);
      remaining -= (pageH - 20);
      if (remaining > 0) { pdf.addPage(); y = 10 - (imgH - remaining); }
    }
    pdf.save("relatorio-logbook.pdf");
    setExporting(false);
  };

  useEffect(() => {
    async function load() {
      try {
        const [e, v, c] = await Promise.all([
          base44.entities.Expense.list("-date", 500),
          base44.entities.Vehicle.list(),
          base44.entities.Charging.list("-start_datetime", 500),
        ]);
        setExpenses(Array.isArray(e) ? e : []);
        setVehicles(Array.isArray(v) ? v : []);
        setChargings(Array.isArray(c) ? c : []);
        saveCache("expenses", e);
        saveCache("vehicles", v);
        saveCache("chargings", c);
      } catch {
        setExpenses(loadCache("expenses") || []);
        setVehicles(loadCache("vehicles") || []);
        setChargings(loadCache("chargings") || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    setChartsReady(false);
    let timeoutId;
    const rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => setChartsReady(true), 400);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading]);

  useLayoutEffect(() => {
    setRenderTick(t => t + 1);
  }, [activeTab]);

  // Anos disponíveis a partir dos dados
  const availableYears = useMemo(() => {
    const years = new Set();
    expenses.forEach(e => { if (e.date) years.add(e.date.slice(0, 4)); });
    chargings.forEach(c => { if (c.start_datetime) years.add(c.start_datetime.slice(0, 4)); });
    return [...years].sort().reverse();
  }, [expenses, chargings]);

  // Filtrar por período (ano/mês)
  const periodExpenses = useMemo(() => {
    if (selectedYear === "all") return expenses;
    let result = expenses.filter(e => (e.date || "").slice(0, 4) === selectedYear);
    if (selectedMonth !== "all") {
      result = result.filter(e => (e.date || "").slice(0, 7) === `${selectedYear}-${selectedMonth}`);
    }
    return result;
  }, [expenses, selectedYear, selectedMonth]);

  const periodChargings = useMemo(() => {
    if (selectedYear === "all") return chargings;
    let result = chargings.filter(c => (c.start_datetime || "").slice(0, 4) === selectedYear);
    if (selectedMonth !== "all") {
      result = result.filter(c => (c.start_datetime || "").slice(0, 7) === `${selectedYear}-${selectedMonth}`);
    }
    return result;
  }, [chargings, selectedYear, selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = selectedVehicle === "all" ? periodExpenses : periodExpenses.filter(e => e.vehicle_id === selectedVehicle);

  const hasEREV = Array.isArray(vehicles) && vehicles.some(v => v.fuel_type === "Híbrido EREV");

  const tabs = [
    { id: "overview", label: "Visão Geral" },
    { id: "year", label: "Anual" },
    { id: "fuel", label: "Combustível" },
    { id: "forecast", label: "Previsão" },
    { id: "costperkm", label: "Custo/km" },
    { id: "top", label: "Top Despesas" },
    { id: "monthly", label: "Mensal" },
    ...(hasEREV ? [{ id: "erev", label: "⚡ EREV" }] : []),
  ];

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    formatDate(new Date(2000, i, 1), "MMMM", { locale: pt })
  );

  const hasPeriodFilter = selectedYear !== "all" || selectedMonth !== "all";

  return (
    <ChartMeasureContext.Provider value={renderTick}>
      {!chartsReady && (
        <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">A preparar gráficos...</p>
          </div>
        </div>
      )}
      <div className={chartsReady ? "" : "invisible"}>
        <div className="flex flex-col min-h-full space-y-5 px-4 pb-4">
          {/* Page Header */}
          <div className="bg-gradient-to-br from-cyan-500 to-teal-500 -mx-4 px-4 pb-4 text-white sticky top-0 z-20 shadow-lg shadow-cyan-500/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 opacity-80" />
                  Relatórios
                </h1>
                <p className="text-white/60 text-xs mt-0.5">Análise detalhada das despesas</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="h-9 w-44 rounded-xl bg-white/15 border-white/20 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Veículos</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={exportPDF} disabled={exporting} size="sm" className="rounded-xl gap-1.5 bg-white/15 hover:bg-white/25 border-white/20 text-white text-xs h-9">
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? "A exportar..." : "PDF"}
                </Button>
                <Button
                  onClick={() => exportFullReportXLSX({
                    vehicles,
                    expenses: periodExpenses,
                    chargings: periodChargings,
                    notifications: [],
                    parts: [],
                    docs: [],
                    periodLabel: hasPeriodFilter ? (selectedMonth !== "all" ? `${monthNames[parseInt(selectedMonth)-1]} ${selectedYear}` : `Ano ${selectedYear}`) : "Todos",
                  })}
                  size="sm"
                  className="rounded-xl gap-1.5 bg-white/15 hover:bg-white/25 border-white/20 text-white text-xs h-9"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted rounded-2xl p-1.5 overflow-x-auto scrollbar-none">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Period selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedMonth("all"); }}>
              <SelectTrigger className="h-8 w-32 rounded-xl text-xs">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear !== "all" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-36 rounded-xl text-xs">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthNames.map((name, i) => {
                    const m = String(i + 1).padStart(2, "0");
                    return <SelectItem key={m} value={m}>{name.charAt(0).toUpperCase() + name.slice(1)}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
            {hasPeriodFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedYear("all"); setSelectedMonth("all"); }}
                className="h-8 rounded-xl text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
                Limpar
              </Button>
            )}
            {hasPeriodFilter && (
              <span className="text-xs text-muted-foreground ml-1">
                {selectedYear !== "all" && selectedMonth !== "all"
                  ? `${monthNames[parseInt(selectedMonth) - 1]?.charAt(0).toUpperCase() + monthNames[parseInt(selectedMonth) - 1]?.slice(1)} ${selectedYear}`
                  : selectedYear !== "all"
                  ? `Ano ${selectedYear}`
                  : ""}
              </span>
            )}
            {activeTab === "costperkm" && (
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                <span className="text-xs text-muted-foreground mr-0.5">Categorias:</span>
                {[
                  { key: "fuel", label: "Combustível" },
                  { key: "electric", label: "Eletricidade" },
                  { key: "maintenance", label: "Manutenção" },
                  { key: "insurance", label: "Seguros" },
                  { key: "loan", label: "Empréstimos" },
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCostCategories(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      costCategories[cat.key]
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Todos os separadores sempre montados — hidden esconde os inativos */}
          <div ref={reportRef}>
            <div className={activeTab === "overview" ? "" : "hidden"}>
              <div className="space-y-6">
                <ReportMaintenanceReminder vehicles={vehicles} expenses={periodExpenses} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ReportByCategory expenses={filtered} />
                  <ReportByVehicle expenses={periodExpenses} vehicles={vehicles} />
                </div>
                <ReportTimeline expenses={filtered} />
              </div>
            </div>
            <div className={activeTab === "year" ? "" : "hidden"}>
              <ReportYearComparison expenses={filtered} />
            </div>
            <div className={activeTab === "fuel" ? "" : "hidden"}>
              <div className="space-y-6">
                <FuelPriceHistoryChart />
                <ReportFuelStats expenses={filtered} vehicles={vehicles} />
                <ReportFuelHistoryTable expenses={filtered} vehicles={vehicles} />
              </div>
            </div>
            <div className={activeTab === "forecast" ? "" : "hidden"}>
              <ReportForecast expenses={filtered} />
            </div>
            <div className={activeTab === "costperkm" ? "" : "hidden"}>
              <div className="space-y-4">
                <ReportCostPerKmSavings expenses={periodExpenses} chargings={periodChargings} vehicles={vehicles} />
                <ReportCostPerKm expenses={periodExpenses} vehicles={vehicles} selectedCategories={costCategories} />
                <ReportFuelCostComparison expenses={periodExpenses} vehicles={vehicles} />
              </div>
            </div>
            <div className={activeTab === "top" ? "" : "hidden"}>
              <ReportTopExpenses expenses={filtered} vehicles={vehicles} />
            </div>
            <div className={activeTab === "monthly" ? "" : "hidden"}>
              <ReportMonthly expenses={filtered} vehicles={vehicles} />
            </div>
            {hasEREV && (
              <div className={activeTab === "erev" ? "" : "hidden"}>
                <ReportEREV expenses={periodExpenses} chargings={periodChargings} vehicles={vehicles} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ChartMeasureContext.Provider>
  );
}