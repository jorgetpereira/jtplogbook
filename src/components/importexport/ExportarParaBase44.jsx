import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, Download } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Exporta apenas os registos a partir de uma data, no formato que a importação
// por entidade aceita.
//
// Três cuidados que fazem a diferença entre isto funcionar e dar erro do outro
// lado: sai a matrícula em vez do identificador do veículo, porque o Base44
// não conhece os identificadores criados aqui; saem também os identificadores
// dos próprios registos, para ele criar os seus; e como a importação despreza
// registos com a mesma data e valor, uma importação repetida não duplica nada.
// ---------------------------------------------------------------------------

const CAMPOS_FORA = new Set([
  "id",
  "vehicle_id",
  "created_date",
  "updated_date",
  "created_by",
  "created_by_id",
  "is_sample",
]);

function limpar(registo, matricula) {
  const saida = {};
  for (const [chave, valor] of Object.entries(registo)) {
    if (CAMPOS_FORA.has(chave)) continue;
    if (valor === null || valor === undefined || valor === "") continue;
    saida[chave] = valor;
  }
  if (matricula) saida.license_plate = matricula;
  return saida;
}

function descarregar(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

export default function ExportarParaBase44() {
  const umaSemanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(umaSemanaAtras);
  const [ocupado, setOcupado] = useState(false);

  const exportar = async (tipo) => {
    setOcupado(true);
    try {
      const veiculos = await base44.entities.Vehicle.list();
      const matriculaDe = Object.fromEntries(
        veiculos.map((v) => [v.id, v.license_plate])
      );

      const ehCarregamento = tipo === "Charging";
      const entidade = ehCarregamento ? base44.entities.Charging : base44.entities.Expense;
      const campoData = ehCarregamento ? "start_datetime" : "date";

      const todos = await entidade.list();
      const filtrados = todos.filter((r) => String(r[campoData] || "").slice(0, 10) >= desde);

      if (!filtrados.length) {
        toast.info("Não há registos a partir dessa data.");
        return;
      }

      const semMatricula = filtrados.filter((r) => !matriculaDe[r.vehicle_id]).length;
      const saida = filtrados.map((r) => limpar(r, matriculaDe[r.vehicle_id]));

      const nome = `${ehCarregamento ? "carregamentos" : "despesas"}-desde-${desde}.json`;
      descarregar(nome, JSON.stringify(saida, null, 2));

      toast.success(`${filtrados.length} registos exportados`);
      if (semMatricula) {
        toast.warning(`${semMatricula} sem matrícula — vão ficar sem veículo associado.`);
      }
    } catch (err) {
      toast.error(`Não foi possível exportar: ${err.message}`);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 border-l-4 border-l-violet-500 bg-violet-50/50">
      <div>
        <p className="font-medium flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-violet-600" />
          Exportar para o Base44
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Só os registos a partir da data escolhida, prontos a importar na app antiga.
          O veículo vai pela matrícula, para não dar erro do outro lado.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm shrink-0">A partir de</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => exportar("Expense")}
        >
          <Download className="w-4 h-4 mr-1.5" />
          Despesas
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => exportar("Charging")}
        >
          <Download className="w-4 h-4 mr-1.5" />
          Carregamentos
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        No Base44, importa cada ficheiro na secção da entidade respectiva. Se importares
        o mesmo ficheiro duas vezes, os registos repetidos são ignorados.
      </p>
    </Card>
  );
}
