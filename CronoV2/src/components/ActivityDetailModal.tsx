import { Badge, Button, Modal } from '@/components/ui';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_COLORS,
  ROLE_LABELS,
  type Activity,
} from '@/types';
import { formatDateTime, initials } from '@/lib/utils';
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Mail,
  Phone,
  Wrench,
  StickyNote,
  HardHat,
  ArrowRight,
  User,
} from 'lucide-react';
import type { MapActivity } from '@/components/activityMapMeta';

function isLate(a: Activity): boolean {
  if (a.status === 'concluida' || a.status === 'cancelada') return false;
  if (!a.planned_date) return false;
  const planned = new Date(a.planned_date);
  planned.setHours(23, 59, 59, 999);
  return planned < new Date();
}

function daysLate(a: Activity): number {
  if (!a.planned_date) return 0;
  const planned = new Date(a.planned_date);
  planned.setHours(0, 0, 0, 0);
  const diff = Math.floor((Date.now() - planned.getTime()) / 86400000);
  return Math.max(0, diff);
}

function formatDateBR(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon} {title}
      </p>
      <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
        {children}
      </p>
    </div>
  );
}

export function ActivityDetailModal({
  activity,
  onClose,
  onOpen,
}: {
  activity: MapActivity | null;
  onClose: () => void;
  onOpen?: (id: string) => void;
}) {
  if (!activity) return null;

  const late = isLate(activity);
  const responsible = activity.responsible;
  const project = activity.project;
  const hasCoords = activity.latitude != null && activity.longitude != null;

  return (
    <Modal open={!!activity} onClose={onClose} title="Detalhes da atividade" size="lg">
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{activity.number}</p>
            <h3 className="mt-0.5 text-lg font-bold leading-snug text-slate-900 dark:text-white">{activity.title}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge
              className={
                late
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                  : ACTIVITY_STATUS_COLORS[activity.status]
              }
            >
              {late ? 'Atrasada' : ACTIVITY_STATUS_LABELS[activity.status]}
            </Badge>
            {late && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">
                <AlertTriangle size={12} />
                {daysLate(activity)} dia{daysLate(activity) > 1 ? 's' : ''} de atraso
              </span>
            )}
          </div>
        </div>

        {/* Obra e usuário */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <HardHat size={14} /> Obra
            </p>
            {project ? (
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">{project.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {project.code}
                  {project.status ? ` · ${project.status}` : ''}
                </p>
                {(project.city || project.state) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[project.city, project.state].filter(Boolean).join(' - ') || '—'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem obra vinculada</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <User size={14} /> Usuário responsável
            </p>
            {responsible ? (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  {initials(responsible.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{responsible.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABELS[responsible.role]}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {responsible.email && (
                      <span className="flex min-w-0 items-center gap-1"><Mail size={12} className="shrink-0" /><span className="truncate">{responsible.email}</span></span>
                    )}
                    {responsible.phone && (
                      <span className="flex items-center gap-1"><Phone size={12} className="shrink-0" />{responsible.phone}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Não atribuído</p>
            )}
          </div>
        </div>

{/* Datas */}
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <InfoItem icon={<Calendar size={16} />} label="Data planejada" value={formatDateBR(activity.planned_date)} />
          <InfoItem icon={<Clock size={16} />} label="Horário planejado" value={activity.planned_time ?? '-'} />
          <InfoItem icon={<Clock size={16} />} label="Iniciada em" value={formatDateTime(activity.started_at)} />
          <InfoItem icon={<Clock size={16} />} label="Finalizada em" value={formatDateTime(activity.finished_at)} />
        </div>

        {/* Local */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <MapPin size={14} /> Local
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {activity.location ?? (hasCoords ? `${activity.latitude?.toFixed(6)}, ${activity.longitude?.toFixed(6)}` : 'Não informado')}
          </p>
          {hasCoords && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Coordenadas: {activity.latitude?.toFixed(6)}, {activity.longitude?.toFixed(6)}
            </p>
          )}
        </div>

        {/* Detalhamento */}
        {activity.description && (
          <Section icon={<FileText size={14} />} title="Descrição">
            {activity.description}
          </Section>
        )}
        {activity.service_description && (
          <Section icon={<Wrench size={14} />} title="Descrição do serviço">
            {activity.service_description}
          </Section>
        )}
        {activity.observations && (
          <Section icon={<StickyNote size={14} />} title="Observações">
            {activity.observations}
          </Section>
        )}
        {activity.problems && (
          <Section icon={<AlertTriangle size={14} />} title="Problemas">
            {activity.problems}
          </Section>
        )}

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          {onOpen && (
            <Button onClick={() => { onClose(); onOpen(activity.id); }}>
              Abrir atividade completa <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
