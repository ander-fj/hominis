# Checklist de Homologação Final

## Segurança
- [ ] RLS ativo em tabelas operacionais
- [ ] Técnico não acessa dados administrativos
- [ ] Financeiro não altera atividades operacionais
- [ ] Admin mantém acesso administrativo

## Fluxos
- [ ] Transições inválidas de atividade são bloqueadas
- [ ] Histórico é registrado
- [ ] Checklist obrigatório impede conclusão
- [ ] Operação offline sincroniza após retorno da internet

## Qualidade
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Auditoria sem falhas críticas inesperadas
