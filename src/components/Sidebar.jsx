import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  BookOpen,
  BarChart3,
  ArrowDownUp,
  Bell,
  Info,
  Fuel,
  Wrench,
  X,
  ChevronDown
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mainLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/registos", icon: BookOpen, label: "Registos" },
  { to: "/vehicles", icon: Car, label: "Veículos" },
];

const logbookLinks = [
  { to: "/expenses?category=Combustível", icon: Fuel, label: "Combustível" },
  { to: "/expenses?category=Manutenção", icon: Wrench, label: "Manutenção" },
  { to: "/expenses", icon: BookOpen, label: "Todos os Registos" },
];

const toolLinks = [
  { to: "/reports", icon: BarChart3, label: "Relatórios" },
  { to: "/stations", icon: Fuel, label: "Postos" },
  { to: "/import-export", icon: ArrowDownUp, label: "Importar / Exportar" },
  { to: "/notifications", icon: Bell, label: "Notificações" },
  { to: "/about", icon: Info, label: "Sobre" },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const [logbookOpen, setLogbookOpen] = useState(true);

  const isActive = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname + location.search === to || location.pathname === to.split("?")[0] && location.search === "?" + to.split("?")[1];
  };

  return (
    <aside className="w-72 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">O meu Logbook</h1>
            <p className="text-xs text-sidebar-foreground/50">Gestão de Viaturas</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-sidebar-accent rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Principal
        </p>
        {mainLinks.map((link) => (
          <NavLink key={link.to} {...link} active={isActive(link.to)} onClick={onClose} />
        ))}

        {/* Logbook Dropdown */}
        <button
          onClick={() => setLogbookOpen(!logbookOpen)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          <BookOpen className="w-4 h-4" />
          <span className="flex-1 text-left">Mais</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", logbookOpen && "rotate-180")} />
        </button>
        {logbookOpen && (
          <div className="ml-4 space-y-0.5">
            {logbookLinks.map((link) => (
              <NavLink key={link.to} {...link} active={isActive(link.to)} onClick={onClose} small />
            ))}
          </div>
        )}

        <div className="pt-4">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Ferramentas
          </p>
          {toolLinks.map((link) => (
            <NavLink key={link.to} {...link} active={isActive(link.to)} onClick={onClose} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/30 text-center">
          © 2026 O meu Logbook v1.0
        </p>
      </div>
    </aside>
  );
}

function NavLink({ to, icon: Icon, label, active, onClick, small }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 rounded-lg font-medium transition-all",
        small ? "py-2 text-xs" : "py-2.5 text-sm",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className={cn(small ? "w-3.5 h-3.5" : "w-4 h-4")} />
      <span>{label}</span>
    </Link>
  );
}