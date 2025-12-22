import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { calculateIntelligentRanking } from './rankingEngine';

export function useAutoRecalculate(enabled: boolean = true, intervalMs: number = 10000) {
  const processingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const processQueue = async () => {
      if (processingRef.current) {
        console.log('Já existe um processamento em andamento');
        return;
      }

      try {
        processingRef.current = true;

        const { data: pendingPeriods, error } = await supabase
          .rpc('get_pending_recalculations');

        if (error) {
          console.error('Erro ao buscar recálculos pendentes:', error);
          return;
        }

        if (!pendingPeriods || pendingPeriods.length === 0) {
          return;
        }

        console.log(`🔄 ${pendingPeriods.length} período(s) pendente(s) de recálculo`);

        for (const { period } of pendingPeriods) {
          try {
            console.log(`📊 Recalculando ranking para período: ${period}`);

            await calculateIntelligentRanking(period, false);

            await supabase.rpc('mark_recalculation_completed', {
              p_period: period,
              p_success: true,
              p_error: null
            });

            console.log(`✅ Ranking recalculado: ${period}`);
          } catch (err) {
            console.error(`❌ Erro ao recalcular período ${period}:`, err);

            await supabase.rpc('mark_recalculation_completed', {
              p_period: period,
              p_success: false,
              p_error: (err as Error).message
            });
          }
        }
      } catch (err) {
        console.error('Erro no processamento da fila:', err);
      } finally {
        processingRef.current = false;
      }
    };

    processQueue();

    const interval = setInterval(processQueue, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs]);
}
