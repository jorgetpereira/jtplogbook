import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Colunas esperadas no CSV (case-insensitive, aceita variantes pt/en):
 * vehicle_id, start_datetime, end_datetime, duration_minutes,
 * soc_start_pct, soc_end_pct, kwh_added, kwh_end, range_km,
 * location_type, location_name, odometer, price_per_kwh, total_cost, notes
 */

// Normalize: remove accents, spaces, special chars → lowercase
function norm(s) {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Parse "DD/MM/YYYY HH:MM" → "YYYY-MM-DDTHH:MM"
function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  // DD/MM/YYYY HH:MM
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}T${m[4].padStart(2,"0")}:${m[5]}`;
  return s;
}

// Parse "H:MM" or "HH:MM" duration → minutes
function parseDuration(s) {
  if (!s) return null;
  s = s.trim();
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

// Parse numeric value (handles "13,5", "50%", "2,84 ")
function parseNum(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(",", ".").replace("%", "").trim());
  return isNaN(n) ? null : n;
}

// Detect separator: tab > semicolon > comma
function detectSep(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

// Split a CSV line respecting quoted fields
function splitLine(line, sep) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// Find the header row: first row where at least 3 cols have content
function findHeaderRow(lines, sep) {
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = splitLine(lines[i], sep).filter(c => c.trim() !== "");
    if (cols.length >= 3) return i;
  }
  return 0;
}

// Map normalized header → field name
function mapHeaders(rawHeaders) {
  const fields = [];
  for (const h of rawHeaders) {
    const n = norm(h);
    let field = null;

    // datetime — deve ter "inicio"/"fim" E "hora"/"data"
    if ((n.includes("inicio") || n.includes("start")) && (n.includes("hora") || n.includes("data"))) field = "start_datetime";
    else if ((n.includes("fim") || n.includes("end")) && (n.includes("hora") || n.includes("data"))) field = "end_datetime";
    // duration
    else if (n.includes("tempo") || n === "duracao" || n.includes("duracao")) field = "duration_minutes";
    // SOC início — "percentagem inicio" (sem "a carregar", sem "fim")
    else if ((n.includes("percentagem") || n.includes("soc")) && (n.includes("inicio") || n.includes("start")) && !n.includes("carregar") && !n.includes("fim")) field = "soc_start_pct";
    // SOC fim — "percentagem fim" ou "percentagem indicada"
    else if ((n.includes("percentagem") || n.includes("soc")) && (n.includes("fim") || n.includes("indicada") || n.includes("end")) && !n.includes("carregar") && !n.includes("inicio")) field = "soc_end_pct";
    // % a carregar → soc_start_pct (representa a % de bateria a adicionar, guardamos como campo próprio da entidade; em alternativa pode ser ignorado — mas reconhecemos)
    else if (n.includes("percentagem") && n.includes("carregar")) field = "soc_start_pct"; // mesmo campo que percentagem inicio (redundante mas reconhecido)
    // KWh início (estado da bateria no início)
    else if (n.includes("kwh") && n.includes("inicio")) field = "kwh_end";
    // KWh a carregar = kWh adicionados
    else if (n.includes("kwh") && n.includes("carregar")) field = "kwh_added";
    // KWh fim = kWh estado bateria no fim
    else if (n.includes("kwh") && (n.includes("fim") || n.includes("end"))) field = "kwh_end";
    // Autonomia inicio → range_km (autonomia restante no início — usamos como base)
    else if (n.includes("autonomia") && n.includes("inicio")) field = "range_km";
    // Autonomia (sem qualificador ou "fim") → range_km
    else if (n.includes("autonomia")) field = "range_km";
    // location type
    else if (n === "local_carregamento" || n === "casa_fora" || n === "local" || n === "tipo_local") field = "location_type";
    // location name
    else if (n === "nome_local" || n === "location_name" || n === "posto" || n === "estacao") field = "location_name";
    // odometer
    else if (n.includes("odomet") || n === "quilometragem") field = "odometer";
    // price
    else if (n.includes("preo") || n.includes("preco") || n.includes("prec") || n === "tarifa") field = "price_per_kwh";
    // cost
    else if (n === "custo_total" || n === "total_cost" || n === "custo" || n === "valor_total" || n === "custo_carregamento") field = "total_cost";
    // vehicle
    else if (n === "veiculo" || n === "vehicle_id" || n === "matricula") field = "vehicle_id";
    // notes
    else if (n === "notas" || n === "notes" || n === "observacoes") field = "notes";

    fields.push(field);
  }
  return fields;
}

const NUMERIC = ["duration_minutes","soc_start_pct","soc_end_pct","kwh_added","kwh_end","range_km","odometer","price_per_kwh","total_cost"];

function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const allLines = clean.split(/\r?\n/);
  const lines = allLines.filter(l => l.trim() !== "" && l.replace(/;/g, "").trim() !== "");
  if (lines.length < 2) return { rows: [], detectedCols: [], unknownCols: [], rawHeaders: [] };

  const sep = detectSep(lines[0]);
  const headerIdx = findHeaderRow(lines, sep);
  const rawHeaders = splitLine(lines[headerIdx], sep).map(h => h.replace(/^"|"$/g, "").trim());
  const fieldMap = mapHeaders(rawHeaders);

  const detectedCols = [];
  const unknownCols = [];
  rawHeaders.forEach((h, i) => {
    if (fieldMap[i]) detectedCols.push({ raw: h, mapped: fieldMap[i] });
    else if (h) unknownCols.push(h);
  });

  const rows = lines.slice(headerIdx + 1).map(line => {
    const cols = splitLine(line, sep);
    // Skip rows where all cells are empty
    if (cols.every(c => !c.trim())) return null;
    const row = {};
    fieldMap.forEach((field, i) => {
      if (!field) return;
      const raw = (cols[i] || "").replace(/^"|"$/g, "").trim();
      if (!raw) return;

      if (field === "start_datetime" || field === "end_datetime") {
        const d = parseDate(raw);
        if (d) row[field] = d;
      } else if (field === "duration_minutes") {
        const d = parseDuration(raw);
        if (d != null) row[field] = d;
      } else if (field === "location_type") {
        // Normalize Casa/Fora
        const v = raw.toLowerCase();
        row[field] = v.includes("casa") ? "Casa" : "Fora";
      } else if (NUMERIC.includes(field)) {
        const n = parseNum(raw);
        if (n != null) row[field] = n;
      } else {
        row[field] = raw;
      }
    });
    return row;
  }).filter(r => r && r.start_datetime);

  return { rows, detectedCols, unknownCols, rawHeaders };
}

export default function ChargingCSVImport({ vehicles, onImport, onClose }) {
  const [rows, setRows] = useState(null);
  const [detectedCols, setDetectedCols] = useState([]);
  const [unknownCols, setUnknownCols] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setRows(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { rows: parsed, detectedCols: dc, unknownCols: uc, rawHeaders: rh } = parseCSV(ev.target.result);
        setDetectedCols(dc);
        setUnknownCols(uc);
        setRawHeaders(rh);
        if (parsed.length === 0) {
          setError("Nenhuma linha válida encontrada. Verifique se a coluna da data de início está reconhecida (veja mapeamento abaixo).");
          return;
        }
        const enriched = parsed.map(r => {
          if (!r.vehicle_id && vehicles.length === 1) r.vehicle_id = vehicles[0].id;
          if (r.vehicle_id && !r.vehicle_id.match(/^[a-f0-9-]{20,}$/i)) {
            const match = vehicles.find(v =>
              v.license_plate?.toLowerCase() === r.vehicle_id?.toLowerCase() ||
              `${v.brand} ${v.model}`.toLowerCase() === r.vehicle_id?.toLowerCase()
            );
            if (match) r.vehicle_id = match.id;
          }
          return r;
        });
        setRows(enriched);
      } catch {
        setError("Erro ao processar o ficheiro CSV.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    setImporting(true);
    await onImport(rows);
    setImporting(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle className="w-10 h-10 text-green-500" />
        <p className="font-semibold">Importação concluída!</p>
        <p className="text-sm text-muted-foreground">{rows.length} registo(s) importado(s).</p>
        <Button onClick={onClose} className="mt-2">Fechar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 space-y-1.5">
        <p className="font-semibold text-foreground">Formato esperado (CSV separado por <strong>;</strong>)</p>
        <p>Colunas reconhecidas automaticamente (nomes flexíveis):</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
          <span className="text-foreground font-semibold">Data e hora Inicio</span><span>DD/MM/AAAA HH:MM</span>
          <span className="text-foreground font-semibold">Data e hora Fim</span><span>DD/MM/AAAA HH:MM</span>
          <span className="text-foreground font-semibold">Tempo carregamento</span><span>HH:MM (ex: 04:55)</span>
          <span className="text-foreground font-semibold">Percentagem indicada</span><span>SOC fim (ex: 50%)</span>
          <span className="text-foreground font-semibold">KWh inicio</span><span>kWh estado bateria</span>
          <span className="text-foreground font-semibold">Autonomia</span><span>km autonomia</span>
          <span className="text-foreground font-semibold">Percentagem a carregar</span><span>SOC início</span>
          <span className="text-foreground font-semibold">KWh fim</span><span>kWh adicionados</span>
          <span className="text-foreground font-semibold">Local carregamento</span><span>Casa ou Fora</span>
          <span className="text-foreground font-semibold">Odometro</span><span>km no odómetro</span>
          <span className="text-foreground font-semibold">Preo KWh</span><span>€/kWh</span>
        </div>
        <p className="pt-0.5">Se só tiver um veículo EV, é atribuído automaticamente. Pode ter linhas de título no início — são ignoradas.</p>
      </div>

      <div
        className="border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Clique para escolher um ficheiro CSV</p>
        <p className="text-xs text-muted-foreground mt-1">Exportado do Excel (Guardar como CSV)</p>
        <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
      </div>

      {/* Debug: todas as colunas detetadas no ficheiro */}
      {rawHeaders.length > 0 && (
        <div className="border border-border rounded-xl p-3 text-xs space-y-2">
          <p className="font-semibold">Colunas detetadas no ficheiro ({rawHeaders.length})</p>
          <div className="flex flex-wrap gap-1">
            {rawHeaders.map((h, i) => {
              const mapped = detectedCols.find(c => c.raw === h);
              return (
                <span key={i} className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${
                  mapped
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                    : "bg-muted text-muted-foreground border-border"
                }`}>
                  {h || "(vazia)"}{mapped ? ` ✓ ${mapped.mapped}` : ""}
                </span>
              );
            })}
          </div>
          {unknownCols.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-[10px]">
              ⚠ Não reconhecidas: {unknownCols.join(", ")} — renomeie-as conforme a tabela acima.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            {detectedCols.length > 0 && !detectedCols.find(c => c.mapped === "start_datetime") && (
              <p className="mt-1 text-xs">A coluna da data de início não foi reconhecida. Nomeie-a como: <strong>inicio</strong>, <strong>data_inicio</strong>, <strong>start_datetime</strong> ou <strong>data_carregamento</strong>.</p>
            )}
          </div>
        </div>
      )}

      {rows && !error && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-600">{rows.length} registo(s) encontrado(s) para importar.</p>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-[10px]">
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Data início</th>
                  <th className="px-2 py-1 text-left">% início</th>
                  <th className="px-2 py-1 text-left">% fim</th>
                  <th className="px-2 py-1 text-left">kWh</th>
                  <th className="px-2 py-1 text-left">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-2 py-1">{r.start_datetime ? r.start_datetime.replace("T", " ") : "—"}</td>
                    <td className="px-2 py-1">{r.soc_start_pct ?? "—"}</td>
                    <td className="px-2 py-1">{r.soc_end_pct ?? "—"}</td>
                    <td className="px-2 py-1">{r.kwh_added ?? "—"}</td>
                    <td className="px-2 py-1">{r.total_cost != null ? `€${r.total_cost.toFixed(2)}` : r.price_per_kwh != null ? `${r.price_per_kwh}€/kWh` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleImport} disabled={importing} className="flex-1">
              {importing ? "A importar..." : `Importar ${rows.length} registo(s)`}
            </Button>
          </div>
        </div>
      )}

      {!rows && !error && (
        <Button variant="outline" onClick={onClose} className="w-full">Cancelar</Button>
      )}
    </div>
  );
}