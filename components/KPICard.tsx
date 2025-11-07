/**
 * KPI Card Component
 *
 * Displays a metric with trend indicator and optional sparkline
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
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
        {hasTrend && (
          <div className="flex items-center gap-1">
            {!isNeutral && (
              <span className={isPositive ? "text-green-600" : "text-red-600"}>
                {isPositive ? "↑" : "↓"}
              </span>
            )}
            <span
              className={`text-sm font-medium ${
                isPositive
                  ? "text-green-600"
                  : isNegative
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              {isNeutral
                ? "—"
                : `${Math.abs(trend.percentage).toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>
      {hasTrend && (
        <p className="text-xs text-gray-500 mt-1">
          {isNeutral
            ? "No change from previous period"
            : `${isPositive ? "+" : ""}${trend.change.toLocaleString()} from previous period`}
        </p>
      )}
    </div>
  );
}
