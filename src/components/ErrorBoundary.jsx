import React from "react";

// Sem isto, qualquer erro durante a renderização deixa o ecrã em branco e sem
// pista nenhuma. Com isto, aparece uma mensagem legível e o texto do erro,
// que é o que permite perceber o que se passou — sobretudo quando acontece
// longe do computador, numa garagem sem rede.

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro na aplicação:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail = `${error?.message || error}\n\n${error?.stack || ""}`.trim();

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-lg font-bold">Alguma coisa correu mal</h1>

          <p className="text-sm text-muted-foreground">
            Os teus registos estão guardados no aparelho e não se perderam.
            Recarrega a app para continuar.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
            >
              Recarregar
            </button>

            <button
              onClick={() => navigator.clipboard?.writeText(detail)}
              className="px-4 py-2 rounded-xl border border-input text-sm font-bold"
            >
              Copiar erro
            </button>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Detalhes técnicos</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words max-h-64 overflow-auto">
              {detail}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
