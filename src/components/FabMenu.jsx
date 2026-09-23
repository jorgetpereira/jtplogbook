import { Fuel, Wallet, Wrench, Zap, Bell, AlertTriangle, FileSpreadsheet, X, ClipboardCheck, ShieldCheck, Landmark } from "lucide-react";

const items = [
  { type: "fuel", label: "Abastecimento", icon: Fuel, color: "bg-orange-500" },
  { type: "expense", label: "Despesa / Manutenção", icon: Wallet, color: "bg-red-500" },
  { type: "service", label: "Serviço / Revisão", icon: Wrench, color: "bg-amber-700" },
  { type: "charging", label: "Carregamento", icon: Zap, color: "bg-blue-500" },
  { type: "insurance", label: "Seguro", icon: ShieldCheck, color: "bg-indigo-600" },
  { type: "loan", label: "Empréstimo", icon: Landmark, color: "bg-pink-600" },
  { type: "notification", label: "Lembrete", icon: Bell, color: "bg-purple-500" },
  { type: "issue", label: "Avarias", icon: AlertTriangle, color: "bg-rose-500" },
  { type: "checklist", label: "Checklist Inspeção", icon: ClipboardCheck, color: "bg-teal-600" },
  { type: "gsheets", label: "Backup GSheets", icon: FileSpreadsheet, color: "bg-green-600" },
];

export default function FabMenu({ open, onClose, onSelect }) {
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Menu card */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[220px] card-shadow"
        style={{ bottom: 'calc(3.75rem + 0.75rem)' }}
      >
        <div className="flex flex-col gap-0.5">
          {items.map((item, i) => (
            <button
              key={item.type}
              onClick={() => { onSelect(item.type); onClose(); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors text-left active:scale-[0.98]"
            >
              <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center shrink-0 shadow-sm`}>
                <item.icon className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Triangle tail */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0"
          style={{
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '10px solid hsl(var(--card))',
          }}
        />
      </div>
    </>
  );
}