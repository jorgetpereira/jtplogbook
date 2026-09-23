import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, sublabel, trend, className }) {
  return (
    <div className={cn(
      "bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trend > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
          )}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}