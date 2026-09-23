import { FileText, ExternalLink } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export default function GreenCardPopover({ url }) {
  if (!url) return null;
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition-colors">
          <FileText className="w-3 h-3" /> Carta Verde
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        {isImage ? (
          <img src={url} alt="Carta Verde" className="w-full rounded-md" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-3">
            <FileText className="w-8 h-8 text-primary" />
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Abrir documento <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}