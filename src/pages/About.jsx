import { BookOpen, Shield } from "lucide-react";

export default function About() {

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white px-4 pb-4 sticky top-0 z-20 shadow-lg shadow-primary/20" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 opacity-80" />
          Sobre
        </h1>
        <p className="text-white/60 text-xs mt-0.5">Informação da aplicação</p>
      </div>

      <div className="max-w-3xl mx-auto w-full space-y-10 py-4">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-xl shadow-primary/20">
            <BookOpen className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">O meu Logbook</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            A aplicação completa para gerir todas as despesas com as suas viaturas.
          </p>
          <p className="text-muted-foreground">Desenvolvido com dedicação para a<br />gestão eficiente das suas viaturas.</p>
          <div className="h-8" />
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Versão 1.0.0</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Desenvolvido por: JORGE TIAGO PEREIRA</p>
          <p className="text-xs">© 2026 Jorge Tiago Pereira - LogBook</p>
          <p className="text-xs">Todos os Direitos Reservados</p>
        </div>
      </div>
    </div>
  );
}