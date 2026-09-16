export function calculateDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = today.toISOString().split('T')[0];

  if (period === 'all') {
    return {
      startDate: '1900-01-01',
      endDate: endDate,
    };
  }

  if (period === 'today') {
    return {
      startDate: endDate,
      endDate: endDate,
    };
  }

  if (period === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return {
      startDate: yesterdayStr,
      endDate: yesterdayStr,
    };
  }

  if (period === 'this_week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: endDate,
    };
  }

  if (period === 'last_week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() + diff - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    return {
      startDate: lastMonday.toISOString().split('T')[0],
      endDate: lastSunday.toISOString().split('T')[0],
    };
  }

  if (period === 'this_month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: endDate,
    };
  }

  if (period === 'last_month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    };
  }

  if (period.startsWith('custom_')) {
    const parts = period.replace('custom_', '').split('_');
    return {
      startDate: parts[0],
      endDate: parts[1],
    };
  }

  if (period.includes('-')) {
    return {
      startDate: period,
      endDate: period,
    };
  }

  const days = parseInt(period);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate,
  };
}

export function getPeriodLabel(period: string): string {
  if (period === 'all') return 'Todos os Períodos';
  if (period === 'today') return 'Hoje';
  if (period === 'yesterday') return 'Ontem';
  if (period === 'this_week') return 'Esta Semana';
  if (period === 'last_week') return 'Semana Passada';
  if (period === 'this_month') return 'Este Mês';
  if (period === 'last_month') return 'Mês Passado';

  if (period.startsWith('custom_')) {
    const parts = period.replace('custom_', '').split('_');
    const start = new Date(parts[0]).toLocaleDateString('pt-BR');
    const end = new Date(parts[1]).toLocaleDateString('pt-BR');
    return `${start} - ${end}`;
  }

  if (period.includes('-')) {
    const date = new Date(period);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  const days = parseInt(period);
  return `Últimos ${days} dias`;
}
