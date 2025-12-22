import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAvailablePeriods } from '../../lib/usePeriods';

interface PeriodFilterProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  label?: string;
  showConsolidated?: boolean;
  onCustomRangeChange?: (startDate: string, endDate: string) => void;
}

export default function PeriodFilter({
  selectedPeriod,
  onPeriodChange,
  label = 'Período',
  showConsolidated = true,
  onCustomRangeChange
}: PeriodFilterProps) {
  const { periods, loading } = useAvailablePeriods();
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const quickPeriods = [
    { value: 'today', label: '📅 Hoje' },
    { value: 'yesterday', label: '📅 Ontem' },
    { value: 'this_week', label: '📆 Esta Semana' },
    { value: 'last_week', label: '📆 Semana Passada' },
    { value: 'this_month', label: '📆 Este Mês' },
    { value: 'last_month', label: '📆 Mês Passado' },
  ];

  const rangePeriods = [
    { value: '7', label: '⏱️ Últimos 7 dias' },
    { value: '30', label: '⏱️ Últimos 30 dias' },
    { value: '90', label: '⏱️ Últimos 90 dias' },
    { value: '180', label: '⏱️ Últimos 6 meses' },
    { value: '365', label: '⏱️ Último ano' },
  ];

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      onPeriodChange(value);
    }
  };

  const handleApplyCustomRange = () => {
    if (startDate && endDate && onCustomRangeChange) {
      onCustomRangeChange(startDate, endDate);
      onPeriodChange(`custom_${startDate}_${endDate}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-gray-700">
        <Calendar className="w-5 h-5 text-[#002b55]" />
        <span className="font-medium text-sm">{label}:</span>
      </div>
      <select
        value={selectedPeriod.startsWith('custom_') ? 'custom' : selectedPeriod}
        onChange={(e) => handlePeriodChange(e.target.value)}
        disabled={loading}
        className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002b55] focus:border-[#002b55] bg-white text-gray-700 font-medium shadow-sm hover:border-[#002b55] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showConsolidated && (
          <option value="all">📊 Consolidado (Todos os Períodos)</option>
        )}

        <optgroup label="Períodos Rápidos">
          {quickPeriods.map(period => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </optgroup>

        <optgroup label="Intervalos">
          {rangePeriods.map(period => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
          <option value="custom">🗓️ Período Personalizado</option>
        </optgroup>

        {periods.length > 0 && (
          <optgroup label="Períodos Específicos">
            {periods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {showCustomRange && (
        <div className="flex items-center gap-2 bg-white border-2 border-[#002b55] rounded-lg p-2 shadow-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">De:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#002b55] focus:border-[#002b55] text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Até:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#002b55] focus:border-[#002b55] text-sm"
            />
          </div>
          <button
            onClick={handleApplyCustomRange}
            disabled={!startDate || !endDate}
            className="px-4 py-1.5 bg-gradient-to-r from-[#002b55] to-[#003d73] text-white font-semibold rounded hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Aplicar
          </button>
          <button
            onClick={() => {
              setShowCustomRange(false);
              setStartDate('');
              setEndDate('');
              onPeriodChange('this_month');
            }}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 font-medium rounded hover:bg-gray-300 transition-all text-sm"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
