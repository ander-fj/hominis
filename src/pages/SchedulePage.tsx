import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Expand, Filter, MapPin, Minimize, Users, X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ACTIVITY_STATUS_LABELS as STATUS_LABELS, type Profile, type ActivityStatus } from '@/types';
import { initials } from '@/lib/utils';

type ViewMode = 'day' | 'week';

type ScheduleItem = {
  id: string;
  title: string;
  number: string;
  planned_date: string | null;
  planned_time: string | null;
  location: string | null;
  status: ActivityStatus;
  responsible_id: string | null;
  responsible: { name: string } | null;
};

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => HOUR_START + index);
const ROW_HEIGHT = 84; // matches min-h-[84px] on hour cells (content only; actual height includes padding & border)
const STATUS_COLORS: Record<ActivityStatus, string> = {
  planejada: 'border-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
  em_deslocamento: 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100',
  em_andamento: 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
  pausada: 'border-orange-400 bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100',
  aguardando_validacao: 'border-violet-400 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
  concluida: 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
  cancelada: 'border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100',
};

const STATUS_DOTS: Record<ActivityStatus, string> = {
  planejada: 'bg-sky-400',
  em_deslocamento: 'bg-cyan-400',
  em_andamento: 'bg-amber-400',
  pausada: 'bg-orange-400',
  aguardando_validacao: 'bg-violet-400',
  concluida: 'bg-emerald-400',
  cancelada: 'bg-rose-400',
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatRange(date: Date, mode: ViewMode): string {
  if (mode === 'day') {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const end = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${start} – ${end}`;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function formatTime(time: string | null): string {
  if (!time) return 'Dia inteiro';
  return time.slice(0, 5);
}

export function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState<ScheduleItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date());
  const [mode, setMode] = useState<ViewMode>('week');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const currentTimeLineRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const headerRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  const [headerOffset, setHeaderOffset] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const [activityResult, profileResult] = await Promise.all([
        supabase
          .from('activities')
          .select('id, title, number, planned_date, planned_time, location, status, responsible_id, responsible:profiles(name)')
          .not('planned_date', 'is', null)
          .order('planned_date')
          .order('planned_time'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
      ]);

      if (activityResult.error || profileResult.error) {
        setError('Não foi possível carregar a agenda agora.');
      } else {
        setActivities((activityResult.data as unknown as ScheduleItem[]) ?? []);
        setProfiles((profileResult.data as Profile[]) ?? []);
      }
      setLoading(false);
    };

    void load();
  }, []);

  const dates = useMemo(() => {
    if (mode === 'day') return [new Date(date)];
    const weekStart = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [date, mode]);

  const visibleActivities = useMemo(() => {
    if (selectedProfileIds.length === 0) return activities;
    return activities.filter((item) => item.responsible_id && selectedProfileIds.includes(item.responsible_id));
  }, [activities, selectedProfileIds]);

  const activitiesByDate = useMemo(() => {
    return dates.reduce<Record<string, ScheduleItem[]>>((result, currentDate) => {
      result[dateKey(currentDate)] = visibleActivities.filter((item) => item.planned_date === dateKey(currentDate));
      return result;
    }, {});
  }, [dates, visibleActivities]);

  const currentTimeLine = useMemo(() => {
    const todayVisible = dates.some((d) => dateKey(d) === dateKey(now));
    if (!todayVisible) return null;

    const timeInHours = now.getHours() + now.getMinutes() / 60;
    if (timeInHours < HOUR_START || timeInHours > HOUR_END) return null;

    return {
      offsetPx: headerOffset + (timeInHours - HOUR_START) * (rowHeight ?? ROW_HEIGHT),
      label: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }, [dates, now, headerOffset, rowHeight]);

  const goToPrevious = () => setDate((current) => addDays(current, mode === 'day' ? -1 : -7));
  const goToNext = () => setDate((current) => addDays(current, mode === 'day' ? 1 : 7));
  const goToToday = () => setDate(new Date());

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await scheduleRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === scheduleRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderOffset(headerRef.current.offsetHeight);
    } else {
      setHeaderOffset(0);
    }
    if (rowHeightRef.current) {
      setRowHeight(rowHeightRef.current.offsetHeight);
    }
  }, [dates]);

  useEffect(() => {
    // Sincroniza a linha do tempo com o relógio do computador: agenda a primeira
    // atualização para o próximo minuto exato e, depois, renova a cada 60s.
    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60000);
    };

    const nowDate = new Date();
    const msUntilNextMinute = (60 - nowDate.getSeconds()) * 1000 - nowDate.getMilliseconds();
    timeout = setTimeout(tick, msUntilNextMinute);

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const element = currentTimeLineRef.current;
    if (!element) return;

    requestAnimationFrame(() => {
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  }, [date, mode, dates, loading]);

  if (loading) return <Spinner />;

  return (
    <div ref={scheduleRef} className={`page-container ${isFullscreen ? 'min-h-screen overflow-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <CalendarDays size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Planejamento de campo</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanhe a agenda dos colaboradores em um só lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={goToToday} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Hoje</button>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => setMode('day')} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'day' ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>Dia</button>
            <button onClick={() => setMode('week')} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'week' ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>Semana</button>
          </div>
          <button onClick={() => setFiltersOpen((current) => !current)} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${filtersOpen || selectedProfileIds.length > 0 ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
            <Filter size={16} /> Colaboradores{selectedProfileIds.length > 0 ? ` (${selectedProfileIds.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={isFullscreen ? 'Sair da tela cheia' : 'Expandir agenda'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Expandir agenda'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Expand size={16} />}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Visualizar agenda de</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Selecione um ou mais colaboradores.</p>
            </div>
            {selectedProfileIds.length > 0 && <button onClick={() => setSelectedProfileIds([])} className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400">Limpar seleção</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => {
              const selected = selectedProfileIds.includes(profile.id);
              return <button key={profile.id} onClick={() => toggleProfile(profile.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${selected ? 'bg-white/20' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{initials(profile.name)}</span>{profile.name}</button>;
            })}
            {profiles.length === 0 && <span className="text-sm text-slate-500 dark:text-slate-400">Nenhum colaborador ativo encontrado.</span>}
          </div>
        </div>
      )}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
            <div className="flex items-center gap-3"><button onClick={goToPrevious} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ChevronLeft size={19} /></button><button onClick={goToNext} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ChevronRight size={19} /></button><h2 className="text-sm font-bold capitalize text-slate-900 dark:text-white sm:text-base">{formatRange(date, mode)}</h2></div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400"><div className="hidden items-center gap-3 md:flex"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Planejada</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Em andamento</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Concluída</span></div><span className="hidden items-center gap-2 sm:flex"><Users size={15} /> {selectedProfileIds.length ? `${selectedProfileIds.length} selecionado(s)` : 'Todos os colaboradores'}</span></div>
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            <div className={`relative grid min-w-[${mode === 'day' ? '640px' : '980px'}]`} style={{ gridTemplateColumns: `68px repeat(${dates.length}, minmax(150px, 1fr))` }}>
            <div className="border-b border-r border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/30" />
            {dates.map((currentDate) => {
              const isToday = dateKey(currentDate) === dateKey(new Date());
              return <div key={dateKey(currentDate)} ref={isToday ? headerRef : undefined} className={`border-b border-r border-slate-100 px-3 py-3 text-center last:border-r-0 dark:border-slate-800 ${isToday ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-slate-50/70 dark:bg-slate-950/30'}`}><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{formatDay(currentDate)}</p><p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-amber-500 text-white' : 'text-slate-700 dark:text-slate-200'}`}>{currentDate.getDate()}</p></div>;
            })}

            {HOURS.map((hour) => <div key={hour} className="contents"><div className="border-b border-r border-slate-100 px-2 pt-2 text-right text-[11px] font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">{String(hour).padStart(2, '0')}:00</div>{dates.map((currentDate) => { const items = activitiesByDate[dateKey(currentDate)]?.filter((item) => item.planned_time ? Number(item.planned_time.slice(0, 2)) === hour : hour === HOUR_START) ?? []; return <div key={`${dateKey(currentDate)}-${hour}`} ref={hour === HOUR_START && dates[0] ? rowHeightRef : undefined} className="min-h-[84px] border-b border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800">{items.map((item) => <div key={item.id} title={`Obra: ${item.title}\nEndereço: ${item.location || 'Não informado'}\nStatus: ${STATUS_LABELS[item.status]}`} aria-label={`Obra ${item.title}. Endereço: ${item.location || 'não informado'}. Status: ${STATUS_LABELS[item.status]}`} tabIndex={0} onClick={() => setSelectedItem(item)} className={`group mb-1 cursor-pointer rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 ${STATUS_COLORS[item.status]}`}><div className="flex items-start justify-between gap-1"><p className="line-clamp-2 text-xs font-bold leading-4">{item.title}</p><span className="shrink-0 text-[10px] font-semibold opacity-70">{item.number}</span></div><p className="mt-1 flex items-center gap-1 text-[10px] font-medium opacity-75"><Clock3 size={11} /> {formatTime(item.planned_time)}</p>{item.responsible?.name && <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-semibold opacity-80"><Users size={11} className="shrink-0" /> {item.responsible.name}</p>}</div>)}</div>; })}</div>)}
            {currentTimeLine && (
              <div
                ref={currentTimeLineRef}
                className="pointer-events-none absolute z-10"
                style={{ top: `${currentTimeLine.offsetPx}px`, left: 68, right: 0 }}
              >
                <span className="absolute -top-6 left-0 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                  {currentTimeLine.label}
                </span>
                <div className="absolute top-0 left-0 h-0.5 w-full bg-red-500 shadow-md shadow-red-500/50"></div>
                <div className="absolute top-0 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"></div>
              </div>
            )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Legenda:</p>{(Object.keys(STATUS_LABELS) as ActivityStatus[]).map((status) => <span key={status} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />{STATUS_LABELS[status]}</span>)}</div>
        </div>
      )}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className={`relative w-full max-w-md rounded-2xl border-l-4 bg-white p-6 shadow-2xl dark:bg-slate-900 ${STATUS_COLORS[selectedItem.status]}`}>
            <button onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Fechar">
              <X size={18} />
            </button>
            <div className="mb-4">
              <span className="inline-block rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider dark:bg-black/20">{STATUS_LABELS[selectedItem.status]}</span>
            </div>
            <h3 className="pr-8 text-lg font-bold leading-7">{selectedItem.title}</h3>
            <p className="mt-1 text-xs font-semibold opacity-60">#{selectedItem.number}</p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Clock3 size={16} className="mt-0.5 shrink-0 opacity-60" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider opacity-50">Horário</p>
                  <p className="font-medium">{formatTime(selectedItem.planned_time)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 opacity-60" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider opacity-50">Endereço</p>
                  <p className="font-medium">{selectedItem.location || 'Não informado'}</p>
                </div>
              </div>
              {selectedItem.responsible?.name && (
                <div className="flex items-start gap-2.5">
                  <Users size={16} className="mt-0.5 shrink-0 opacity-60" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider opacity-50">Responsável</p>
                    <p className="font-medium">{selectedItem.responsible.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

