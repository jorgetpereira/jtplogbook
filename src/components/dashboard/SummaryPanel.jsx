import { Wallet, CalendarDays, Gauge, Fuel } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export default function SummaryPanel({ expenses, vehicles }) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yr = String(now.getFullYear());

  // This month
  const monthExpenses = expenses.filter(e => (e.date || "").slice(0, 7) === ym);
  const monthTotal = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const monthRefuels = monthExpenses.filter(e => e.category === "Combustível").length;

  // This year
  const yearTotal = expenses
    .filter(e => (e.date || "").slice(0, 4) === yr)
    .reduce((s, e) => s + (e.amount || 0), 0);

  // Average consumption (latest fill-to-fill per vehicle)
  const liquidCons = [];
  const elecCons = [];

  vehicles.forEach(v => {
    const entries = expenses
      .filter(e => e.vehicle_id === v.id && e.category === "Combustível" && e.liters && e.mileage_at_expense)
      .sort((a, b) => a.mileage_at_expense - b.mileage_at_expense);

    // Latest liquid fuel consumption
    const liquid = entries.filter(e => e.sub_category !== "Eletricidade");
    let prev = null;
    let lastLiquid = null;
    liquid.forEach(e => {
      if (prev !== null && e.mileage_at_expense > prev) {
        lastLiquid = +((e.liters / (e.mileage_at_expense - prev)) * 100).toFixed(1);
      }
      prev = e.mileage_at_expense;
    });
    if (lastLiquid !== null) liquidCons.push(lastLiquid);

    // Latest electric consumption
    const elec = entries.filter(e => e.sub_category === "Eletricidade");
    prev = null;
    let lastElec = null;
    elec.forEach(e => {
      if (prev !== null && e.mileage_at_expense > prev) {
        lastElec = +((e.liters / (e.mileage_at_expense - prev)) * 100).toFixed(1);
      }
      prev = e.mileage_at_expense;
    });
    if (lastElec !== null) elecCons.push(lastElec);
  });

  const avgLiquid = liquidCons.length > 0
    ? (liquidCons.reduce((s, c) => s + c, 0) / liquidCons.length).toFixed(1)
    : null;

  const avgElec = elecCons.length > 0
    ? (elecCons.reduce((s, c) => s + c, 0) / elecCons.length).toFixed(1)
    : null;

  const monthName = format(now, "MMMM", { locale: pt });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Descriptive sub-label: reflects the actual category mix so the total
  // is never misattributed to refuels when it was e.g. an inspection.
  const monthFuelCount = monthExpenses.filter(e => e.category === "Combustível").length;
  const monthMaintCount = monthExpenses.filter(e => e.category === "Manutenção").length;
  let monthSubLabel;
  const monthCount = monthExpenses.length;
  if (monthCount === 0) {
    monthSubLabel = "s/ registos";
  } else if (monthFuelCount === monthCount) {
    monthSubLabel = `${monthCount} abastec.${monthCount !== 1 ? "." : ""}`;
  } else if (monthMaintCount === monthCount) {
    monthSubLabel = `${monthCount} manutenç${monthCount !== 1 ? "ões" : "ão"}`;
  } else {
    monthSubLabel = `${monthCount} registo${monthCount !== 1 ? "s" : ""}`;
  }

  const cards = [
    {
      icon: Wallet,
      label: `Gasto em ${monthLabel}`,
      value: `€${monthTotal.toFixed(0)}`,
      sub: monthSubLabel,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-100 dark:border-blue-900",
    },
    {
      icon: CalendarDays,
      label: `Gasto em ${yr}`,
      value: `€${yearTotal.toFixed(0)}`,
      sub: "total anual",
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-100 dark:border-emerald-900",
    },
    {
      icon: Gauge,
      label: "Consumo médio",
      value: avgLiquid && avgElec
        ? `${avgLiquid} L / ${avgElec} kWh`
        : avgLiquid ? `${avgLiquid}` : avgElec ? `${avgElec}` : "—",
      sub: avgLiquid && avgElec
        ? "média por 100km"
        : avgLiquid ? "L/100km" : avgElec ? "kWh/100km" : "s/ dados",
      valueClass: avgLiquid && avgElec ? "text-sm" : "text-xl",
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      border: "border-orange-100 dark:border-orange-900",
    },
    {
      icon: Fuel,
      label: "Abastecimentos",
      value: monthRefuels,
      sub: `em ${monthLabel}`,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-100 dark:border-purple-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div key={i} className={`rounded-2xl border p-3.5 ${c.bg} ${c.border}`}>
          <div className="flex items-center gap-2 mb-2">
            <c.icon className={`w-4 h-4 ${c.color} shrink-0`} />
            <span className="text-[11px] font-medium text-muted-foreground truncate">{c.label}</span>
          </div>
          <p className={`font-bold ${c.valueClass || "text-xl"} ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}