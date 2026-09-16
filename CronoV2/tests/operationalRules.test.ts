import { describe, expect, it } from 'vitest';
import { calculateCompletionRate, isOverdue } from '@/shared/quality/operationalRules';

describe('operational rules', () => {
  it('does not mark completed activities as overdue', () => {
    expect(isOverdue('2020-01-01', 'concluida', new Date('2026-01-01'))).toBe(false);
  });
  it('marks open past activities as overdue', () => {
    expect(isOverdue('2025-12-31', 'planejada', new Date('2026-01-01'))).toBe(true);
  });
  it('calculates completion rate safely', () => {
    expect(calculateCompletionRate(4, 3)).toBe(75);
    expect(calculateCompletionRate(0, 0)).toBe(0);
  });
});
