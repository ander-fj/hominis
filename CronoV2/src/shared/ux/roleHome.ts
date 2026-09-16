import type { UserRole } from '@/types';
export function getRoleHome(role?: UserRole) {
  if (role === 'tecnico') return { title: 'Operação de campo', description: 'Execute suas atividades, registre evidências e mantenha o status atualizado.', primary: 'Minhas atividades' };
  if (role === 'financeiro') return { title: 'Controle financeiro', description: 'Acompanhe despesas, aprovações e relatórios da operação.', primary: 'Despesas' };
  return { title: 'Visão da operação', description: 'Acompanhe prioridades, atrasos, custos e produtividade da equipe.', primary: 'Dashboard' };
}
