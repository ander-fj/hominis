# Sprint 13 — Automação em Background

Implementa persistência de execuções, função segura para job automático e base para agendamento periódico.

## Ativação
1. Execute a migration `20260902_background_automation.sql`.
2. Teste manualmente: `select public.run_operational_health_check_job();`
3. Se `pg_cron` estiver habilitado no projeto, habilite o agendamento comentado na migration.

O frontend mantém execução manual e pode consultar o histórico em `automation_runs`.
