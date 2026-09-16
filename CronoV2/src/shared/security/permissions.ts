import type { UserRole } from '@/types';
import type { PageKey } from '@/components/Layout';

export const PAGE_ACCESS: Record<PageKey, UserRole[]> = {
  dashboard: ['admin', 'gestor', 'tecnico', 'financeiro'],
  management: ['admin', 'gestor', 'financeiro'],
  expenses: ['admin', 'gestor', 'tecnico', 'financeiro'],
  reports: ['admin', 'gestor', 'financeiro'],
  notifications: ['admin', 'gestor', 'tecnico', 'financeiro'],
  'notification-preferences': ['admin', 'gestor', 'tecnico', 'financeiro'],
  automation: ['admin', 'gestor'],
  intelligence: ['admin', 'gestor', 'financeiro'],
  quality: ['admin', 'gestor'],
  projects: ['admin', 'gestor', 'financeiro'],
  'work-orders': ['admin', 'gestor', 'tecnico'],
  activities: ['admin', 'gestor', 'tecnico'],
  schedule: ['admin', 'gestor', 'tecnico'],
  clients: ['admin', 'gestor', 'financeiro'],
  teams: ['admin', 'gestor'],
  vehicles: ['admin', 'gestor', 'tecnico'],
  users: ['admin'],
  settings: ['admin'],
};

export function canAccessPage(role: UserRole | undefined, page: PageKey) {
  return !!role && PAGE_ACCESS[page].includes(role);
}

export function canManageUsers(role: UserRole | undefined) { return role === 'admin'; }
export function canManageOperationalData(role: UserRole | undefined) { return role === 'admin' || role === 'gestor'; }
export function canManageFinancialData(role: UserRole | undefined) { return role === 'admin' || role === 'financeiro'; }
