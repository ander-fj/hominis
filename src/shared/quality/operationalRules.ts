import type { ActivityStatus } from '@/types';

export const FINAL_ACTIVITY_STATUSES: ActivityStatus[] = ['concluida', 'cancelada'];

export function isFinalActivityStatus(status: ActivityStatus) {
  return FINAL_ACTIVITY_STATUSES.includes(status);
}

export function isOverdue(scheduledDate: string | null | undefined, status: ActivityStatus, now = new Date()) {
  if (!scheduledDate || isFinalActivityStatus(status)) return false;
  return new Date(scheduledDate).getTime() < now.getTime();
}

export function calculateCompletionRate(total: number, completed: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 10000) / 100;
}
