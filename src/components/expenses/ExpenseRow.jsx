import { Fuel, Wrench, Pencil, Trash2, MoreHorizontal, MapPin, Gauge, Zap, FileDown, ShieldCheck, Landmark } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateExpensePDF } from "@/lib/expenseReceipt";

const CATEGORY_STYLES = {
  "Revisão":           { bg: "bg-blue-500",    light: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100" },
  "Pneus":             { bg: "bg-violet-500",  light: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-100" },
  "Estacionamento":    { bg: "bg-slate-500",   light: "bg-slate-50",   text: "text-slate-500",   border: "border-slate-100" },
  "Multa":             { bg: "bg-red-500",     light: "bg-red-50",     text: "text-red-600",     border: "border-red-100" },
  "Reparação de Peça": { bg: "bg-orange-500",  light: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-100" },
  "Seguro":            { bg: "bg-indigo-500",  light: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-100" },
  "Crédito":           { bg: "bg-pink-500",    light: "bg-pink-50",    text: "text-pink-600",    border: "border-pink-100" },
  "Leasing":           { bg: "bg-purple-500",  light: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-100" },
  "Renting":           { bg: "bg-fuchsia-500", light: "bg-fuchsia-50", text: "text-fuchsia-600", border: "border-fuchsia-100" },
  "Inspeção":          { bg: "bg-cyan-500",    light: "bg-cyan-50",    text: "text-cyan-600",    border: "border-cyan-100" },
  "Lavagem":           { bg: "bg-teal-500",    light: "bg-teal-50",    text: "text-teal-600",    border: "border-teal-100" },
  "Portagens":         { bg: "bg-yellow-500",  light: "bg-yellow-50",  text: "text-yellow-600",  border: "border-yellow-100" },
  "IUC":               { bg: "bg-rose-500",    light: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100" },
  "Outro":             { bg: "bg-gray-400",    light: "bg-gray-50",    text: "text-gray-500",    border: "border-gray-100" },
};

const GREEN  = { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" };
const LIME   = { bg: "bg-lime-500",    light: "bg-lime-50",    text: "text-lime-600",    border: "border-lime-100" };
const AMBER  = { bg: "bg-amber-400",   light: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" };
const ORANGE = { bg: "bg-orange-500",  light: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-100" };
const RED    = { bg: "bg-red-500",     light: "bg-red-50",     text: "text-red-600",     border: "border-red-100" };

function getFuelStyle(consumption, isElectric, vehicle) {
  if (!consumption) return { bg: "bg-primary", light: "bg-primary/10", text: "text-primary", border: "border-primary/20" };

  let v;
  if (typeof consumption === "object") {
    // Híbrido: usar o valor do tipo relevante
    const val = isElectric ? consumption.Eletricidade : consumption.Gasolina;
    v = parseFloat(val);
  } else {
    v = parseFloat(consumption);
  }
  if (isNaN(v)) return { bg: "bg-primary", light: "bg-primary/10", text: "text-primary", border: "border-primary/20" };

  // Referência: média anunciada do veículo
  const isVehicleEREV = vehicle?.fuel_type === "Híbrido EREV";
  const advertised = (isElectric || isVehicleEREV)
    ? (vehicle?.advertised_consumption_electric || vehicle?.advertised_consumption)
    : vehicle?.advertised_consumption;

  if (advertised && advertised > 0) {
    const diff = v - advertised;
    if (diff <= 0)                  return GREEN;  // igual ou melhor
    if (diff <= advertised * 0.1)   return AMBER;  // até 10% acima
    return RED;                                    // mais de 10% acima
  }

  // Fallback escala fixa quando não há média anunciada
  if (isElectric) {
    if (v <= 15) return GREEN;
    if (v <= 20) return AMBER;
    return RED;
  }
  if (v <= 5)  return GREEN;
  if (v <= 7)  return AMBER;
  return RED;
}

export default function ExpenseRow({ expense, vehicle, consumption, consumptionKm, kmDriven, isFirstFuel, onEdit, onDelete, isLast }) {
  const isFuel = expense.category === "Combustível";
  const isElectric = expense.sub_category === "Eletricidade";

  const isHybridElectric = isElectric && (vehicle?.fuel_type === "Híbrido" || vehicle?.fuel_type === "Híbrido EREV");

  const isAccumulated = isFuel && !isElectric && expense.full_tank === false && !!consumption;
  const isPendingPartial = isFuel && !isElectric && expense.full_tank === false && !consumption && !isFirstFuel;
  const consumptionKmVal = consumptionKm || kmDriven;

  // Cor principal: apenas fill-to-fill vs média anunciada do veículo
  const style = isFuel && isFirstFuel && !consumption
    ? { bg: "bg-primary", light: "bg-primary/10", text: "text-primary", border: "border-primary/20" }
    : isFuel
    ? getFuelStyle(consumption, isElectric, vehicle)
    : (CATEGORY_STYLES[expense.sub_category] || CATEGORY_STYLES["Outro"]);

  // Indicador car_avg_consumption vs consumo calculado
  const carAvg = expense.car_avg_consumption;
  const calcVal = consumption
    ? (typeof consumption === "object"
        ? parseFloat(isElectric ? consumption.Eletricidade : consumption.Gasolina)
        : parseFloat(consumption))
    : null;
  const carAvgDot = carAvg && calcVal && !isNaN(calcVal)
    ? (calcVal <= carAvg ? "green" : calcVal <= carAvg * 1.1 ? "amber" : "red")
    : null;
  const carAvgDelta = carAvg && calcVal && !isNaN(calcVal)
    ? (calcVal - carAvg).toFixed(1)
    : null;

  return (
    <div className="flex gap-3 group">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-10 shrink-0 pt-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 ${style.bg} shadow-sm`}>
          {isFuel
            ? isElectric
              ? <Zap className="w-4 h-4 text-white" />
              : <Fuel className="w-4 h-4 text-white" />
            : expense.category === "Seguros"
              ? <ShieldCheck className="w-4 h-4 text-white" />
              : expense.category === "Empréstimos"
                ? <Landmark className="w-4 h-4 text-white" />
                : <Wrench className="w-4 h-4 text-white" />
          }
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-2 mb-0" style={{ minHeight: "32px" }} />}
      </div>

      {/* Card Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className={`bg-card rounded-2xl border ${style.border} px-4 py-3 card-shadow transition-all duration-200 group-hover:shadow-md`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground leading-tight">
                  {expense.sub_category || expense.category}
                </p>
                {isFuel && isFirstFuel && (
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">1.º registo</span>
                )}
              </div>
              {vehicle && (vehicle.license_plate || vehicle.brand) && (
                <div className="flex items-center gap-1.5 mt-1">
                  {vehicle.license_plate ? (
                    <span className="font-mono text-[11px] font-bold bg-secondary border border-border px-2 py-0.5 rounded-lg tracking-widest text-foreground">
                      {vehicle.license_plate}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {vehicle.brand} {vehicle.model}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {expense.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{expense.location}</span>
                  </div>
                )}
                {expense.mileage_at_expense && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gauge className="w-3 h-3 shrink-0" />
                    <span>{expense.mileage_at_expense.toLocaleString()} km</span>
                    {kmDriven && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        +{kmDriven.toLocaleString()} km
                      </span>
                    )}
                  </div>
                )}
              </div>

              {expense.liters && (
                <div className="flex items-center gap-2 mt-1.5 whitespace-nowrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.light} ${style.text}`}>
                    {expense.liters}{isElectric ? " kWh" : " L"}
                    {expense.price_per_unit ? ` · €${Number(expense.price_per_unit).toFixed(3)}/${isElectric ? "kWh" : "L"}` : ""}
                    {" "}
                    {expense.full_tank === false
                      ? <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                          Parcial{expense.tank_percentage ? ` · ${expense.tank_percentage}%` : " · ~75%"}
                        </span>
                      : <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">Cheio ✓</span>
                    }
                  </span>
                </div>
              )}

              {/* Consumo calculado (fill-to-fill) */}
              {consumption && (
                <div className={`mt-1.5 text-xs font-semibold ${style.text}`}>
                  {typeof consumption === "object" ? (
                    <div className="flex flex-col gap-1">
                      {consumption.Gasolina && (
                        <div className="flex flex-col gap-0">
                          <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wide">Combustível</span>
                          <span>⛽ {consumption.Gasolina} L/100km</span>
                        </div>
                      )}
                      {consumption.Eletricidade && (
                        <div className="flex flex-col gap-0.5">
                          <span>🔋 <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wide">Elétrico</span> {consumption.Eletricidade} kWh/100km</span>
                          {carAvg && carAvgDot && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground font-normal">
                              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${carAvgDot === "green" ? "bg-emerald-500" : carAvgDot === "amber" ? "bg-amber-400" : "bg-red-500"}`} />
                              Média carro: {carAvg} kWh/100km
                              {carAvgDelta && (
                                <span className={`font-semibold ${parseFloat(carAvgDelta) <= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  ({parseFloat(carAvgDelta) > 0 ? "+" : ""}{carAvgDelta})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span title={isAccumulated ? "Consumo acumulado entre o abastecimento cheio anterior e o seguinte" : "Consumo calculado entre este e o abastecimento anterior"} className="whitespace-nowrap">
                        {isElectric ? "⚡" : "🛢️"} <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wide">{isElectric ? "Elétrico" : "Combustível"}</span> {consumption} {isElectric ? "kWh/100km" : "L/100km"}{isAccumulated ? <span className="font-normal text-muted-foreground"> em {consumptionKmVal} km (acumulado)</span> : consumptionKmVal ? <span className="font-normal text-muted-foreground"> em {consumptionKmVal} km</span> : <span className="font-normal text-muted-foreground"> (calculado)</span>}
                      </span>
                      {carAvg && carAvgDot && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-normal whitespace-nowrap">
                          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${carAvgDot === "green" ? "bg-emerald-500" : carAvgDot === "amber" ? "bg-amber-400" : "bg-red-500"}`} />
                          Média carro: {carAvg} {isElectric ? "kWh/100km" : "L/100km"}{carAvgDelta && <span className={`font-semibold ${parseFloat(carAvgDelta) <= 0 ? "text-emerald-600" : "text-red-500"}`}> ({parseFloat(carAvgDelta) > 0 ? "+" : ""}{carAvgDelta})</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Parcial fóssil sem cheio de fecho — aguarda próximo cheio */}
              {isPendingPartial && (
                <div className="mt-1.5 text-xs text-muted-foreground italic space-y-0.5">
                  <div>⏳ A aguardar abastecimento cheio para calcular o consumo</div>
                  {expense.car_avg_consumption && (
                    <div className="not-italic font-medium">
                      📊 Média carro: {expense.car_avg_consumption} {isElectric ? "kWh/100km" : "L/100km"}
                    </div>
                  )}
                </div>
              )}
              {/* Para híbridos elétricos sem fill-to-fill: mostrar apenas o valor do carro */}
              {!consumption && isHybridElectric && expense.car_avg_consumption && (
                <div className={`mt-1.5 text-xs font-semibold ${style.text}`}>
                  <span>⚡ {expense.car_avg_consumption} kWh/100km <span className="font-normal text-muted-foreground">(carro)</span></span>
                </div>
              )}


            </div>

            {/* Right side */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[11px] text-muted-foreground font-medium">
                {format(new Date(expense.date + "T12:00:00"), "d MMM.", { locale: pt })}
              </span>
              <span className="font-bold text-base text-foreground tabular-nums">
                {expense.amount?.toFixed(2)} <span className="text-sm font-semibold text-muted-foreground">€</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-1">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => generateExpensePDF(expense, vehicle)} className="rounded-lg">
                    <FileDown className="w-3.5 h-3.5 mr-2" /> Comprovativo PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEdit} className="rounded-lg">
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive rounded-lg">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}