import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MRSStatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  trendLabel?: string;
  colorClass?: string;
}

export default function MRSStatCard({
  title,
  value,
  icon,
  trend,
  trendLabel = 'vs mês anterior',
  colorClass = 'from-[#912325] to-[#701a1c]'
}: MRSStatCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="w-2.5 h-2.5" />;
    if (trend < 0) return <TrendingDown className="w-2.5 h-2.5" />;
    return <Minus className="w-2.5 h-2.5" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return '';
    if (trend > 0) return 'text-green-600 bg-green-50';
    if (trend < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.1)' }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-[#912325] mb-2">{value}</p>
          {trend !== undefined && (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getTrendColor()}`}>
              {getTrendIcon() && <div className="w-3 h-3">{getTrendIcon()}</div>}
              <span className="text-sm font-semibold">
                {Math.abs(trend)}%
              </span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}