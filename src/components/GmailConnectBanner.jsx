import { useState, useEffect } from "react";
import { Mail, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";

const DISMISSED_KEY = "gmail_connect_dismissed_v1";
const CONNECTED_KEY = "gmail_connected_confirmed_v1";

export default function GmailConnectBanner() {
  const navigate = useNavigate();
  // null = checking, true = connected, false = not connected
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) { setDismissed(true); return; }

    // Se já confirmámos ligação antes, não repetir verificação
    if (localStorage.getItem(CONNECTED_KEY)) { setStatus(true); setDismissed(true); return; }

    // Delay de 2s para não aparecer imediatamente no arranque
    const t = setTimeout(async () => {
      try {
        // Testa se o connector Gmail está operacional chamando a função com dry_run
        const res = await base44.functions.invoke("sendMonthlyReport", { dry_run: true });
        if (res.data?.sent !== undefined || res.data?.skipped || res.data?.month) {
          // Função respondeu — connector está ligado
          localStorage.setItem(CONNECTED_KEY, "1");
          setStatus(true);
          setDismissed(true);
        } else {
          setStatus(false);
        }
      } catch {
        // Função falhou — provavelmente connector não autorizado
        setStatus(false);
      }
    }, 2000);

    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleLaterOrDismiss = () => dismiss();

  // Não mostrar nada se: ainda a verificar, já dispensado, ou já confirmado ligado
  if (dismissed || status === null || status === true) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 px-3 pointer-events-none"
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-auto bg-card border border-border rounded-2xl shadow-xl p-4 flex items-start gap-3 card-shadow">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
          <Mail className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Receber relatórios por email?</p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            O Logbook pode enviar-te resumos mensais de despesas e alertas de manutenção diretamente para o teu Gmail.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs rounded-xl gap-1.5"
              onClick={() => { dismiss(); navigate("/settings"); }}
            >
              Ativar agora
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs rounded-xl text-muted-foreground"
              onClick={handleLaterOrDismiss}
            >
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}