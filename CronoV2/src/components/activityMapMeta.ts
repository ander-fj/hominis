import type { Activity, Project, Profile } from '@/types';

export interface MapActivity extends Activity {
  project: Project | null;
  responsible: Profile | null;
}

export type MapStatusKey = 'planejada' | 'em_andamento' | 'concluida' | 'atrasada';

export const MAP_STATUS_META: Record<MapStatusKey, { label: string; color: string }> = {
  planejada: { label: 'Planejadas', color: '#f59e0b' },
  em_andamento: { label: 'Em andamento', color: '#3b82f6' },
  concluida: { label: 'Concluídas', color: '#10b981' },
  atrasada: { label: 'Atrasadas', color: '#ef4444' },
};

export const MAP_STATUS_KEYS = Object.keys(MAP_STATUS_META) as MapStatusKey[];