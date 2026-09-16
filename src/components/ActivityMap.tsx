import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { User, Calendar, Maximize2, Minimize2, X } from 'lucide-react';
import type { Activity } from '@/types';
import { MAP_STATUS_META, MAP_STATUS_KEYS, type MapActivity, type MapStatusKey } from './activityMapMeta';

function isLate(a: Activity): boolean {
  if (a.status === 'concluida' || a.status === 'cancelada') return false;
  if (!a.planned_date) return false;
  const planned = new Date(a.planned_date);
  planned.setHours(23, 59, 59, 999);
  return planned < new Date();
}

function formatDateBR(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function classify(a: Activity): MapStatusKey | null {
  if (a.status === 'cancelada') return null;
  if (a.status === 'concluida') return 'concluida';
  if (isLate(a)) return 'atrasada';
  return a.status === 'em_andamento' ? 'em_andamento' : 'planejada';
}

function isValidPair(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) > 0 &&
    Math.abs(lng) > 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function getCoords(a: MapActivity): [number, number] | null {
  const candidates: [number | null, number | null][] = [
    [a.latitude, a.longitude],
    [a.finish_latitude, a.finish_longitude],
    [a.start_latitude, a.start_longitude],
    [a.project?.latitude ?? null, a.project?.longitude ?? null],
  ];
  for (const [lat, lng] of candidates) {
    if (lat != null && lng != null && isValidPair(Number(lat), Number(lng))) {
      return [Number(lat), Number(lng)];
    }
  }
  return null;
}

function markerIcon(color: string, late: boolean): L.DivIcon {
  return L.divIcon({
    className: 'activity-marker',
    html: `<div class="am-pin${late ? ' am-pin-late' : ''}" style="background:${color};"><div class="am-dot"></div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
    tooltipAnchor: [0, -18],
  });
}

function FitBounds({ items, expanded }: { items: { coords: [number, number] }[]; expanded: boolean }) {
  const map = useMap();
  const points = useMemo(() => items.map((i) => i.coords), [items]);
  useEffect(() => {
    if (points.length === 0) return;
    const raf = window.requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        map.fitBounds(points as L.LatLngBoundsLiteral, { padding: [40, 40], maxZoom: 15 });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [map, points, expanded]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [-14.235, -51.925];

export function ActivityMap({
  activities,
  onSelect,
}: {
  activities: MapActivity[];
  onSelect: (activity: MapActivity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MapStatusKey[]>([]);

  // Sair da tela cheia com a tecla Esc
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Trava o scroll da página enquanto o mapa estiver em tela cheia
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const markers = useMemo(() => {
    const list: { activity: MapActivity; key: MapStatusKey; coords: [number, number] }[] = [];
    for (const a of activities) {
      const key = classify(a);
      if (!key) continue;
      const coords = getCoords(a);
      if (!coords) continue;
      list.push({ activity: a, key, coords });
    }
    return list;
  }, [activities]);

  const counts = useMemo(() => {
    const c: Record<MapStatusKey, number> = { planejada: 0, em_andamento: 0, concluida: 0, atrasada: 0 };
    for (const m of markers) c[m.key]++;
    return c;
  }, [markers]);

  // Marcadores visíveis de acordo com os status selecionados na legenda
  const filteredMarkers = useMemo(
    () => (statusFilter.length === 0 ? markers : markers.filter((m) => statusFilter.includes(m.key))),
    [markers, statusFilter],
  );

  const toggleStatus = (k: MapStatusKey) => {
    setStatusFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const hasFilter = statusFilter.length > 0;

  const noCoordCount = useMemo(
    () => activities.filter((a) => classify(a) !== null && getCoords(a) === null).length,
    [activities],
  );

  return (
    <div
      className={`activity-map isolate w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        expanded ? 'fixed inset-0 z-40 rounded-none border-0 shadow-none' : 'relative h-[460px] sm:h-[520px]'
      }`}
    >
      <MapContainer center={DEFAULT_CENTER} zoom={4} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds items={filteredMarkers} expanded={expanded} />
        {filteredMarkers.map((m) => (
          <Marker
            key={m.activity.id}
            position={m.coords}
            icon={markerIcon(MAP_STATUS_META[m.key].color, m.key === 'atrasada')}
            eventHandlers={{ click: () => onSelect(m.activity) }}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={1} className="activity-marker-tip">
              <div className="min-w-[180px] max-w-[260px]">
                <p className="text-sm font-semibold text-slate-900">{m.activity.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {m.activity.project?.name ?? 'Sem obra'} · {MAP_STATUS_META[m.key].label}
                </p>
                <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
                  <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <User size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{m.activity.responsible?.name ?? 'Não atribuído'}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Calendar size={12} className="shrink-0 text-slate-400" />
                    {formatDateBR(m.activity.planned_date)}
                    {m.activity.planned_time ? ` às ${m.activity.planned_time.slice(0, 5)}` : ''}
                  </p>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Botão expandir / recolher */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="absolute right-3 top-3 z-[1000] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-lg backdrop-blur transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-300 dark:hover:bg-slate-700"
        title={expanded ? 'Sair da tela cheia (Esc)' : 'Expandir para tela cheia'}
        aria-label={expanded ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
      >
        {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      {/* Legenda (clique para filtrar) */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Legenda</p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter([])}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X size={12} /> Limpar filtro
            </button>
          )}
        </div>
        <div className="space-y-1">
          {MAP_STATUS_KEYS.map((k) => {
            const active = statusFilter.includes(k);
            const dimmed = hasFilter && !active;
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleStatus(k)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm transition ${dimmed ? 'opacity-40 hover:opacity-70' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title={active ? `Mostrar todos menos ${MAP_STATUS_META[k].label}` : `Mostrar apenas ${MAP_STATUS_META[k].label}`}
              >
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow dark:border-slate-800 ${active ? 'ring-2 ring-slate-400' : ''}`}
                  style={{ background: MAP_STATUS_META[k].color }}
                />
                <span className={`text-slate-700 dark:text-slate-200 ${active ? 'font-semibold' : ''}`}>
                  {MAP_STATUS_META[k].label}
                </span>
                <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-900 dark:text-white">{counts[k]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aviso de atividades sem coordenadas */}
      {noCoordCount > 0 && (
        <div className="absolute right-3 top-16 z-[1000] max-w-[280px] rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow backdrop-blur dark:border-amber-900 dark:bg-amber-950/90 dark:text-amber-200">
          {noCoordCount} atividade{noCoordCount > 1 ? 's' : ''} sem coordenadas não aparecem no mapa.
        </div>
      )}
    </div>
  );
}

