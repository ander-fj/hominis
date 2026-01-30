import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  trendLabel?: string;
  colorClass?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  colorClass = 'from-blue-600 to-cyan-500'
}: StatCardProps) {
  const hasTrend = trend !== undefined;
  let trendIcon: ReactNode = null;
  let trendColorClass = 'text-slate-500';

  if (hasTrend) {
    if (trend > 0) {
      trendIcon = <TrendingUp className="w-4 h-4" />;
      trendColorClass = 'text-green-600';
    } else if (trend < 0) {
      trendIcon = <TrendingDown className="w-4 h-4" />;
      trendColorClass = 'text-red-600';
    } else {
      trendIcon = <Minus className="w-4 h-4" />;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          {hasTrend && (
            <div className={clsx('flex items-center gap-1 mt-2', trendColorClass)}>
              {trendIcon}
              <span className="text-sm font-medium">
                {Math.abs(trend)}% {trendLabel || 'vs mês anterior'}
              </span>
            </div>
          )}
        </div>
        <div className={twMerge('w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-md', colorClass)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
