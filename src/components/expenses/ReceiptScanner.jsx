import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ReceiptScanner({ onExtracted, isElectric, isFuel }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const unit = isElectric ? "kWh" : "litros";

      const prompt = isFuel
        ? `Analisa este talão de abastecimento de combustível/eletricidade de um veículo.
Extrai os seguintes dados em JSON:
- amount: valor total pago em euros (número, null se não encontrar)
- liters: quantidade de ${unit} abastecidos (número, null se não encontrar)
- price_per_unit: preço por ${unit} em euros (número, null se não encontrar)
- location: nome do posto / local (string, null se não encontrar)
- date: data no formato YYYY-MM-DD (string, null se não encontrar)

Responde APENAS com o JSON, sem texto adicional.`
        : `Analisa este talão/fatura de manutenção/serviço automóvel.
Extrai os seguintes dados em JSON:
- amount: valor total pago em euros (número, null se não encontrar)
- location: nome da oficina / local (string, null se não encontrar)
- date: data no formato YYYY-MM-DD (string, null se não encontrar)
- description: breve descrição do serviço realizado (string, null se não encontrar)

Responde APENAS com o JSON, sem texto adicional.`;

      const schema = isFuel
        ? {
            type: "object",
            properties: {
              amount: { type: "number" },
              liters: { type: "number" },
              price_per_unit: { type: "number" },
              location: { type: "string" },
              date: { type: "string" },
            }
          }
        : {
            type: "object",
            properties: {
              amount: { type: "number" },
              location: { type: "string" },
              date: { type: "string" },
              description: { type: "string" },
            }
          };

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url],
        response_json_schema: schema,
      });
      onExtracted(result);
    } catch (err) {
      alert("Não foi possível ler o talão. Tente novamente.");
    } finally {
      setScanning(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {preview && (
        <div className="relative">
          <img src={preview} alt="Talão" className="w-full max-h-40 object-cover rounded-xl border border-border" />
          <button
            type="button"
            onClick={clearPreview}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {scanning ? (
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/5 border border-primary/20 text-primary text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          A ler talão com IA...
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Camera button — triggers native camera on mobile */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border border-dashed border-border hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <Camera className="w-5 h-5" />
            <span className="text-xs font-medium">Tirar Foto</span>
          </button>

          {/* Gallery button */}
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border border-dashed border-border hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-xs font-medium">Carregar Imagem</span>
          </button>
        </div>
      )}

      {/* Camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      {/* Gallery input — no capture attribute so it opens the gallery */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}