/**
 * KPI Card Component
 * "Luminous Precision" Style (Hara/Rams)
 */

interface KPICardProps {
  label: string;
  value: number;
  trend?: {
    change: number;
    percentage: number;
  };
  format?: (val: number) => string;
}

export function KPICard({ label, value, trend, format = (v) => v.toLocaleString() }: KPICardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = hasTrend && trend.percentage > 0;
  const isNegative = hasTrend && trend.percentage < 0;
  const isNeutral = hasTrend && trend.percentage === 0;

  return (
    <div className="flex flex-col justify-between h-full p-6 border border-border bg-surface transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted group-hover:text-foreground transition-colors">
          {label}
        </p>
        
        {hasTrend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            isPositive ? "text-emerald-600 dark:text-emerald-400" : 
            isNegative ? "text-rose-600 dark:text-rose-400" : 
            "text-muted"
          }`}>
             <span>{isNeutral ? "—" : `${isPositive ? "↑" : "↓"} ${Math.abs(trend.percentage).toFixed(1)}%`}</span>
          </div>
        )}
      </div>

      <div className="mt-auto">
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {format(value)}
        </p>
      </div>
    </div>
  );
}
