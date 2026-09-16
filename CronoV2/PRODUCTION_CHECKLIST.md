# Sprint 15 — Checklist de Produção

## Antes do deploy
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no ambiente de produção
- [ ] Nenhuma service_role key exposta no frontend
- [ ] Todas as migrations executadas em ordem
- [ ] RLS revisado no Supabase

## Testes funcionais
- [ ] Login e logout
- [ ] Perfis e permissões
- [ ] Atividade em campo
- [ ] Offline e sincronização
- [ ] Despesas e aprovação
- [ ] Veículos
- [ ] Dashboard e relatórios
- [ ] PWA instalado em Android e desktop

## Após o deploy
- [ ] Verificar console por erros
- [ ] Verificar requisições ao Supabase
- [ ] Validar automações em background
- [ ] Revisar últimas execuções e notificações
