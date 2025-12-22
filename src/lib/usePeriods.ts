import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface Period {
  value: string;
  label: string;
}

export function useAvailablePeriods() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('employee_rankings')
        .select('period')
        .order('period', { ascending: false });

      if (error) throw error;

      const uniquePeriods = [...new Set(data.map(item => item.period))];

      const periodOptions: Period[] = uniquePeriods.map(period => {
        const date = new Date(period + 'T00:00:00');
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();

        return {
          value: period,
          label: `${month} ${year}`
        };
      });

      setPeriods(periodOptions);
    } catch (error) {
      console.error('❌ Erro ao carregar períodos:', error);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  return { periods, loading, reload: loadPeriods };
}
