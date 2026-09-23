import { Fuel, Wrench } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export default function RecentExpenses({ expenses, vehicles }) {
  const recent = expenses.slice(0, 8);
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  if (recent.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="font-semibold mb-4">Últimos Registos</h3>
        <p className="text-muted-foreground text-sm text-center py-8">
          Nenhum registo encontrado. Comece por adicionar uma despesa.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h3 className="font-semibold mb-4">Últimos Registos</h3>
      <div className="space-y-3">
        {recent.map((expense) => {
          const vehicle = vehicleMap[expense.vehicle_id];
          return (
            <div key={expense.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                expense.category === "Combustível" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
              }`}>
                {expense.category === "Combustível" ? <Fuel className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{expense.sub_category}</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle ? `${vehicle.brand} ${vehicle.model}` : "—"} · {format(new Date(expense.date), "d MMM", { locale: pt })}
                </p>
              </div>
              <p className="text-sm font-semibold">€{expense.amount?.toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}