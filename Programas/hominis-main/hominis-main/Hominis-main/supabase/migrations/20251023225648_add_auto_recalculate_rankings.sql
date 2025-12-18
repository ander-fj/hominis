/*
  # Recálculo Automático de Rankings

  1. Função de Recálculo
    - Cria função que dispara recálculo quando dados são inseridos/atualizados
    - Armazena períodos para processar em lote
  
  2. Sistema de Notificação
    - Marca períodos que precisam recálculo
    - Evita múltiplos recálculos simultâneos
  
  3. Tabela de Controle
    - Rastreia períodos pendentes de recálculo
    - Status de processamento

  Importante:
  - Usa NOTIFY para comunicação assíncrona
  - Evita overhead de triggers síncronos
  - Permite processamento em lote
*/

-- Tabela para controlar recálculos pendentes
CREATE TABLE IF NOT EXISTS ranking_recalculation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  UNIQUE(period, status)
);

CREATE INDEX IF NOT EXISTS idx_recalc_queue_pending ON ranking_recalculation_queue(period, status) WHERE status = 'pending';

-- Função para marcar período para recálculo
CREATE OR REPLACE FUNCTION mark_period_for_recalculation()
RETURNS trigger AS $$
BEGIN
  -- Insere na fila apenas se não existir pendente
  INSERT INTO ranking_recalculation_queue (period, status)
  VALUES (
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.period
      ELSE NEW.period
    END,
    'pending'
  )
  ON CONFLICT (period, status) 
  DO NOTHING;
  
  -- Notifica sistema externo (opcional, para processamento em tempo real)
  PERFORM pg_notify('ranking_recalc_needed', 
    json_build_object(
      'period', CASE WHEN TG_OP = 'DELETE' THEN OLD.period ELSE NEW.period END,
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para employee_scores
DROP TRIGGER IF EXISTS trigger_recalc_on_score_change ON employee_scores;
CREATE TRIGGER trigger_recalc_on_score_change
  AFTER INSERT OR UPDATE OR DELETE ON employee_scores
  FOR EACH ROW
  EXECUTE FUNCTION mark_period_for_recalculation();

-- Função para processar fila de recálculos
CREATE OR REPLACE FUNCTION get_pending_recalculations()
RETURNS TABLE(period date) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT rq.period
  FROM ranking_recalculation_queue rq
  WHERE rq.status = 'pending'
  ORDER BY rq.period DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar período como processado
CREATE OR REPLACE FUNCTION mark_recalculation_completed(p_period date, p_success boolean DEFAULT true, p_error text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE ranking_recalculation_queue
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'error' END,
    processed_at = now(),
    error_message = p_error
  WHERE period = p_period AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Limpar registros antigos completados (manter apenas últimos 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_recalculation_records()
RETURNS void AS $$
BEGIN
  DELETE FROM ranking_recalculation_queue
  WHERE status = 'completed' 
    AND processed_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;