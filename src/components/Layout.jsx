import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LayoutList, BarChart3, Car, MoreHorizontal, Plus, ArrowLeft, Fuel, Bell, Zap, Wrench, X } from "lucide-react";
import { useState } from "react";
import GmailConnectBanner from "@/components/GmailConnectBanner";
import FabMenu from "@/components/FabMenu";

const tabs = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", color: "text-blue-500", bg: "bg-blue-500/10" },
  { to: "/registos", icon: LayoutList, label: "Registos", color: "text-orange-500", bg: "bg-orange-500/10" },
  { to: "/reports", icon: BarChart3, label: "Relatórios", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  null, // FAB placeholder
  { to: "/revisao", icon: Wrench, label: "Revisão", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { to: "/charging", icon: Zap, label: "Carregamentos", color: "text-blue-500", bg: "bg-blue-500/10" },
  { to: "/more", icon: MoreHorizontal, label: "Mais", color: "text-gray-500", bg: "bg-gray-500/10" },
];

function MoreMenu({ open, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-4 z-50 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-60 card-shadow" style={{ bottom: '4.5rem' }}>
        {[
          { to: "/vehicles", label: "🚗  Veículos", desc: "As tuas viaturas" },
          { to: "/stations", label: "⛽  Postos", desc: "Combustível e EV" },
          { to: "/notifications", label: "🔔  Lembretes", desc: "Alertas" },
          { to: "/historico", label: "📋  Histórico", desc: "Avarias resolvidas" },
          { to: "/settings", label: "⚙️  Definições", desc: "Preferências" },
          { to: "/import-export", label: "📁  Importar / Exportar", desc: "Dados" },
          { to: "/about", label: "ℹ️  Sobre", desc: "App info" },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            className="flex items-center justify-between px-4 py-3 text-sm rounded-xl hover:bg-accent/60 transition-colors group"
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-[11px] text-muted-foreground group-hover:text-accent-foreground">{item.desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

const TAB_ROOTS = ["/", "/reports", "/registos", "/expenses", "/vehicles", "/revisao", "/stations", "/charging", "/notifications"];

function isNestedRoute(pathname) {
  const exact = TAB_ROOTS.includes(pathname);
  if (exact) return false;
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const nested = isNestedRoute(location.pathname);
  const isActive = (path) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleTabClick = (e, path) => {
    e.preventDefault();
    navigate(path, { replace: isActive(path) });
    setMoreOpen(false);
  };

  return (
    <div className="bg-background flex flex-col" style={{ height: '100dvh', paddingTop: 0 }}>
      {/* Back button bar for nested screens */}
      {nested && (
        <div
          className="flex items-center px-3 bg-card/90 backdrop-blur-xl border-b border-border/60 shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.25rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-sm font-semibold text-primary hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      )}

      <main
        className="overflow-y-auto flex-1 min-h-0"
        style={{
          paddingTop: nested ? 'calc(3.25rem + env(safe-area-inset-top))' : '0px',
        }}
      >
        <Outlet />
      </main>

      {/* Bottom Tab Navigation */}
      <nav
        className="bg-card/95 backdrop-blur-xl border-t border-border/60 flex items-end shadow-2xl shrink-0 z-30"
        style={{ paddingBottom: '0.25rem', height: '3.75rem' }}
      >
        {tabs.map((tab, i) => {
          if (tab === null) {
            return (
              <div key="fab-slot" className="flex items-center justify-center flex-1 min-w-0">
                <button
                  onClick={() => setFabMenuOpen(prev => !prev)}
                  className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40 transition-transform active:scale-95"
                >
                  {fabMenuOpen
                    ? <X className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
                    : <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />}
                </button>
              </div>
            );
          }
          const active = isActive(tab.to);
          const isMore = tab.to === "/more";

          if (isMore) {
            return (
              <button
                key={tab.to}
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex flex-col items-center justify-center gap-0 flex-1 py-1 transition-all duration-200 min-w-0 ${
                  moreOpen ? tab.color : "text-muted-foreground"
                }`}
              >
                <div className={`p-0.5 rounded-lg transition-all duration-200 ${moreOpen ? tab.bg : ""}`}>
                  <tab.icon className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-medium leading-tight mt-0.5 truncate w-full text-center">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.to}
              onClick={(e) => handleTabClick(e, tab.to)}
              className={`flex flex-col items-center justify-center gap-0 flex-1 py-1 transition-all duration-200 min-w-0 ${
                active ? tab.color : "text-muted-foreground"
              }`}
            >
              <div className={`p-0.5 rounded-lg transition-all duration-200 ${active ? tab.bg : ""}`}>
                <tab.icon className="w-4 h-4" />
              </div>
              <span className={`text-[8px] leading-tight mt-0.5 truncate w-full text-center ${active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
            </button>
          );
        })}

      </nav>

      <FabMenu
        open={fabMenuOpen}
        onClose={() => setFabMenuOpen(false)}
        onSelect={(type) => window.dispatchEvent(new CustomEvent("openFab", { detail: { type } }))}
      />
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      <GmailConnectBanner />
    </div>
  );
}