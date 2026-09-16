import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Badge, Spinner, EmptyState, Modal, Textarea, Input } from '@/components/ui';
import {
  ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_COLORS,
  type Activity, type Project, type Profile, type WorkOrder, type Vehicle,
} from '@/types';
import { formatDate, formatDateTime, formatDuration, formatCurrency } from '@/lib/utils';
import { executeFieldTransition } from '@/modules/activities/services/fieldOperation.service';
import { loadActivityChecklist, loadActivityEvidence, toggleChecklistResponse, uploadActivityEvidence, validateActivityCompletion, type ChecklistResponse, type Evidence } from '@/modules/activities/services/checklistEvidence.service';
import {
  Play, Square, MapPin, Calendar, User, Clock, ChevronLeft,
  Car, Camera, Fuel, UtensilsCrossed, Package, DollarSign,
  CheckCircle2, AlertCircle, FileText, ListChecks, Trash2,
  Upload, X, Receipt, ChevronDown, Navigation, Hotel, Building2, House,
} from 'lucide-react';

interface MyActivityPageProps {
  activityId: string;
  onBack: () => void;
}

type RecordType = 'displacement' | 'evidence' | 'fuel' | 'meal' | 'material' | 'expense';

interface ActivityRecord {
  id: string;
  activity_id: string;
  type: RecordType;
  description: string;
  amount: number;
  receipt_path: string | null;
  created_by: string | null;
  created_at: string;
  vehicle_id: string | null;
  odometer: number | null;
}

type ActivityDetail = Activity & { project: Project | null; responsible: Profile | null; work_order: WorkOrder | null };

const RECORD_CONFIG: Record<RecordType, { icon: React.ReactNode; label: string; color: string; hasAmount: boolean; placeholder: string }> = {
  displacement: { icon: <Car size={26} />, label: 'Deslocamento', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900 dark:hover:bg-cyan-900/30', hasAmount: false, placeholder: 'Observações do deslocamento...' },
  evidence: { icon: <Camera size={26} />, label: 'Registrar Evidência', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900 dark:hover:bg-violet-900/30', hasAmount: false, placeholder: 'Descreva a evidência registrada...' },
  fuel: { icon: <Fuel size={26} />, label: 'Registrar Combustível', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900 dark:hover:bg-amber-900/30', hasAmount: true, placeholder: 'Litros, posto, km...' },
  meal: { icon: <UtensilsCrossed size={26} />, label: 'Registrar Refeição', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900 dark:hover:bg-orange-900/30', hasAmount: true, placeholder: 'Local, tipo de refeição...' },
  material: { icon: <Package size={26} />, label: 'Registrar Material', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-900/30', hasAmount: true, placeholder: 'Material utilizado, quantidade...' },
  expense: { icon: <DollarSign size={26} />, label: 'Outra Despesa', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-900/30', hasAmount: true, placeholder: 'Descreva a despesa...' },
};

const TYPE_ORDER: RecordType[] = ['displacement', 'evidence', 'fuel', 'meal', 'material', 'expense'];

const DISPLACEMENT_OPTIONS = [
  { value: 'Início', label: 'Início', icon: <Navigation size={22} /> },
  { value: 'Ir para local', label: 'Ir para local', icon: <MapPin size={22} /> },
  { value: 'Voltar para hotel', label: 'Voltar para hotel', icon: <Hotel size={22} /> },
  { value: 'Voltar para base', label: 'Voltar para base', icon: <Building2 size={22} /> },
  { value: 'Voltar para casa', label: 'Voltar para casa', icon: <House size={22} /> },
];

export function MyActivityPage({ activityId, onBack }: MyActivityPageProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [serviceDescription, setServiceDescription] = useState('');
  const [observations, setObservations] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [recordModalType, setRecordModalType] = useState<RecordType | null>(null);
  const [recordDescription, setRecordDescription] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [recordPreview, setRecordPreview] = useState<string | null>(null);
  const [displacementOption, setDisplacementOption] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [odometer, setOdometer] = useState('');
  const [saving, setSaving] = useState(false);
  const [recordsCollapsed, setRecordsCollapsed] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistResponse[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [evidenceType, setEvidenceType] = useState<Evidence['type']>('FOTO_DURANTE');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*, project:projects(*), responsible:profiles(*), work_order:work_orders(*)')
      .eq('id', activityId)
      .maybeSingle();
    if (error) {
      const { data: retry } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .maybeSingle();
      setActivity(retry as ActivityDetail);
    } else {
      setActivity(data as ActivityDetail);
    }

    const { data: recs } = await supabase
      .from('activity_records')
      .select('*')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false });
    setRecords((recs as ActivityRecord[]) ?? []);
    try { setChecklist(await loadActivityChecklist(activityId)); } catch { setChecklist([]); }
    try { setEvidences(await loadActivityEvidence(activityId)); } catch { setEvidences([]); }

    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase.from('vehicles').select('*').eq('active', true).order('plate')
      .then(({ data }) => setVehicles((data as Vehicle[]) ?? []));
  }, []);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const getPosition = async () => {
    const position = await getCurrentLocation();
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } : null;
  };

  const transitionFieldStatus = async (to: Activity['status'], eventType: string, message: string) => {
    if (!activity || saving) return;
    setSaving(true);
    try {
      const position = await getPosition();
      await executeFieldTransition(activity.id, activity.status, to, eventType, position);
      showFeedback(position ? message : `${message} (sem GPS disponível)`);
      await load();
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar a atividade');
    } finally {
      setSaving(false);
    }
  };

  const startActivity = () => transitionFieldStatus('em_andamento', 'START_ACTIVITY', 'Atividade iniciada');

  const finishActivity = async () => {
    if (!activity || saving) return;
    setSaving(true);
    try {
      await validateActivityCompletion(activity.id);
    await supabase.from('activities').update({
      status: 'concluida',
      finished_at: new Date().toISOString(),
      service_description: serviceDescription || activity.service_description,
      observations: observations || activity.observations,
    }).eq('id', activity.id);
    setFinishModalOpen(false);
    showFeedback('Atividade finalizada');
    await load();
    } catch (error) { showFeedback(error instanceof Error ? error.message : 'Não foi possível finalizar'); } finally { setSaving(false); }
  };

  const handleChecklistToggle = async (item: ChecklistResponse) => {
    setSaving(true);
    try { await toggleChecklistResponse(item.id, !item.checked); await load(); } catch { showFeedback('Não foi possível atualizar o checklist'); } finally { setSaving(false); }
  };

  const handleEvidenceUpload = async () => {
    if (!activity || !evidenceFile || saving) return;
    setSaving(true);
    try { await uploadActivityEvidence(activity.id, evidenceType, evidenceFile); setEvidenceFile(null); showFeedback('Evidência enviada'); await load(); }
    catch (error) { showFeedback(error instanceof Error ? error.message : 'Falha ao enviar evidência'); } finally { setSaving(false); }
  };

  const openRecordModal = (type: RecordType) => {
    setRecordModalType(type);
    setRecordDescription('');
    setRecordAmount('');
    setDisplacementOption(null);
    setSelectedVehicleId(null);
    setOdometer('');
    setRecordFile(null);
    setRecordPreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setRecordFile(file);
    setRecordPreview(URL.createObjectURL(file));
  };

  const clearFile = () => {
    setRecordFile(null);
    if (recordPreview) URL.revokeObjectURL(recordPreview);
    setRecordPreview(null);
  };

  const receiptUrl = (path: string | null) => {
    if (!path) return null;
    return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
  };

  const getCurrentLocation = (): Promise<GeolocationPosition | null> => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    });
  });

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', {
        body: { latitude, longitude },
      });
      if (error || typeof data?.address !== 'string') return null;
      return data.address;
    } catch {
      return null;
    }
  };

  const saveRecord = async () => {
    if (!recordModalType) return;
    if (recordModalType === 'displacement' && !displacementOption) return;
    if (recordModalType === 'displacement' && !selectedVehicleId) return;
    if (recordModalType === 'displacement' && !odometer.trim()) return;
    if (recordModalType !== 'displacement' && !recordDescription.trim()) return;
    setSaving(true);
    const config = RECORD_CONFIG[recordModalType];
    const amount = config.hasAmount ? parseFloat(recordAmount) || 0 : 0;

    let finalDescription = recordDescription.trim();
    let recordVehicleId: string | null = null;
    let recordOdometer: number | null = null;
    if (recordModalType === 'displacement' && displacementOption) {
      recordVehicleId = selectedVehicleId;
      recordOdometer = parseInt(odometer) || 0;
      const position = await getCurrentLocation();
      const now = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date());
      let location = 'Localização não disponível';
      if (position) {
        const address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        location = address ?? 'Localização não disponível';
      }
      finalDescription = `${displacementOption} — ${location} — ${now} (Brasil)`;
    }

    let receiptPath: string | null = null;
    if (config.hasAmount && amount > 0 && recordFile) {
      const ext = recordFile.name.split('.').pop() ?? 'jpg';
      const filePath = `${activityId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(filePath, recordFile, { upsert: false });
      if (!upErr) receiptPath = filePath;
    }

    await supabase.from('activity_records').insert({
      activity_id: activityId,
      type: recordModalType,
      description: finalDescription,
      amount,
      receipt_path: receiptPath,
      vehicle_id: recordVehicleId,
      odometer: recordOdometer,
    });

    if (recordVehicleId && recordOdometer !== null) {
      await supabase.from('vehicles').update({ odometer: recordOdometer }).eq('id', recordVehicleId);
    }

    setSaving(false);
    if (recordPreview) URL.revokeObjectURL(recordPreview);
    setRecordModalType(null);
    showFeedback(`${config.label} registrado`);
    await load();
  };

  const deleteRecord = async (r: ActivityRecord) => {
    if (r.receipt_path) {
      await supabase.storage.from('receipts').remove([r.receipt_path]);
    }
    await supabase.from('activity_records').delete().eq('id', r.id);
    await load();
  };

  if (loading) return <Spinner />;

  if (!activity) {
    return (
      <EmptyState
        icon={<AlertCircle size={48} />}
        title="Atividade não encontrada"
        description="A atividade solicitada não existe ou foi removida."
      />
    );
  }

  const isActive = activity.status === 'em_andamento';
  const isTraveling = activity.status === 'em_deslocamento';
  const isPaused = activity.status === 'pausada';
  const isPlanned = activity.status === 'planejada';
  const isDone = activity.status === 'concluida';

  const totalsByType: Record<RecordType, number> = {
    displacement: 0, evidence: 0, fuel: 0, meal: 0, material: 0, expense: 0,
  };
  records.forEach((r) => { totalsByType[r.type] += r.amount; });
  const grandTotal = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft size={18} />
        Voltar para atividades
      </button>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white dark:from-slate-800 dark:to-slate-700">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold tracking-wide">
              {activity.work_order?.number ?? activity.number}
            </span>
            <Badge className={ACTIVITY_STATUS_COLORS[activity.status]}>
              {ACTIVITY_STATUS_LABELS[activity.status]}
            </Badge>
          </div>
          <h1 className="text-xl font-bold">{activity.title}</h1>
          {activity.description && (
            <p className="mt-1 text-sm text-slate-300 dark:text-slate-400">{activity.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x dark:divide-slate-800">
          <div className="space-y-3 p-5">
            <InfoRow icon={<MapPin size={16} />} label="Obra" value={activity.project?.name ?? '-'} />
            <InfoRow icon={<Calendar size={16} />} label="Data" value={formatDate(activity.planned_date)} />
            <InfoRow icon={<User size={16} />} label="Responsável" value={activity.responsible?.name ?? profile?.name ?? '-'} />
          </div>
          <div className="space-y-3 p-5 sm:pl-5">
            <InfoRow icon={<Clock size={16} />} label="Iniciada em" value={formatDateTime(activity.started_at)} />
            <InfoRow icon={<CheckCircle2 size={16} />} label="Finalizada em" value={formatDateTime(activity.finished_at)} />
            <InfoRow icon={<Clock size={16} />} label="Duração" value={formatDuration(activity.started_at, activity.finished_at)} />
          </div>
        </div>
      </Card>

      {actionFeedback && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-slate-800">
          {actionFeedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isPlanned && (
          <Button size="lg" variant="success" disabled={saving} onClick={() => transitionFieldStatus('em_deslocamento', 'START_TRAVEL', 'Deslocamento iniciado')} className="w-full !py-4 text-base sm:col-span-2">
            <Navigation size={24} />
            {saving ? 'Registrando...' : 'Iniciar Deslocamento'}
          </Button>
        )}
        {isTraveling && (
          <Button size="lg" variant="success" disabled={saving} onClick={startActivity} className="w-full !py-4 text-base sm:col-span-2">
            <MapPin size={24} />
            {saving ? 'Confirmando...' : 'Cheguei ao Local / Iniciar Atividade'}
          </Button>
        )}
        {isPaused && (
          <Button size="lg" variant="success" disabled={saving} onClick={() => transitionFieldStatus('em_andamento', 'RESUME', 'Atividade retomada')} className="w-full !py-4 text-base sm:col-span-2">
            <Play size={24} /> Retomar Atividade
          </Button>
        )}
        {isActive && (
          <Button size="lg" variant="secondary" disabled={saving} onClick={() => transitionFieldStatus('pausada', 'PAUSE', 'Atividade pausada')} className="w-full !py-4 text-base">
            <Clock size={24} /> Pausar
          </Button>
        )}
        {isActive && (
          <Button
            size="lg"
            variant="danger"
            onClick={() => {
              setServiceDescription(activity.service_description ?? '');
              setObservations(activity.observations ?? '');
              setFinishModalOpen(true);
            }}
            className="w-full !py-4 text-base sm:col-span-2"
          >
            <Square size={24} />
            Finalizar Atividade
          </Button>
        )}
        {isDone && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3.5 text-base font-medium text-emerald-700 sm:col-span-2 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 size={24} />
            Atividade Concluída
          </div>
        )}
      </div>

      {isActive && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Registros Rápidos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPE_ORDER.map((type) => {
              const cfg = RECORD_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => openRecordModal(type)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${cfg.color}`}
                >
                  {cfg.icon}
                  <span className="text-xs font-semibold leading-tight">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {isActive && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2"><ListChecks size={18} className="text-slate-400" /><h2 className="text-base font-semibold">Checklist da Atividade</h2></div>
          {checklist.length === 0 ? <p className="text-sm text-slate-500">Nenhum checklist vinculado a esta atividade.</p> : <div className="space-y-2">{checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={item.checked} disabled={saving} onChange={() => handleChecklistToggle(item)} /><span className={item.checked ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.checklist_item?.description}{item.checklist_item?.required ? ' *' : ''}</span></label>)}</div>}
        </Card>
      )}

      {isActive && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2"><Camera size={18} className="text-slate-400" /><h2 className="text-base font-semibold">Evidências</h2></div>
          <div className="grid gap-2 sm:grid-cols-3"><select value={evidenceType} onChange={e => setEvidenceType(e.target.value as Evidence['type'])} className="rounded-lg border p-2"><option value="FOTO_ANTES">Foto antes</option><option value="FOTO_DURANTE">Foto durante</option><option value="FOTO_DEPOIS">Foto depois</option><option value="DOCUMENTO">Documento</option></select><input type="file" accept="image/*,.pdf" onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} /><Button onClick={handleEvidenceUpload} disabled={!evidenceFile || saving}><Upload size={16}/>Enviar</Button></div>
          {evidences.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{evidences.map(ev => <a key={ev.id} href={supabase.storage.from('activity-evidences').getPublicUrl(ev.file_path).data.publicUrl} target="_blank" rel="noreferrer" className="rounded-lg border p-2 text-xs">{ev.type.replace(/_/g, ' ')}<br/><span className="text-slate-400">{formatDateTime(ev.created_at)}</span></a>)}</div>}
        </Card>
      )}

      {records.length > 0 && (
        <Card className="p-5">
          <button
            onClick={() => setRecordsCollapsed((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ListChecks size={18} className="text-slate-400 dark:text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Registros da Atividade</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{records.length}</span>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-400 transition-transform dark:text-slate-500 ${recordsCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
          {!recordsCollapsed && (
          <div className="mt-3 space-y-2">
            {records.map((r) => {
              const cfg = RECORD_CONFIG[r.type];
              return (
                <div key={r.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="mt-0.5 text-slate-400 dark:text-slate-500">{cfg.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cfg.label}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{r.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(r.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {r.amount > 0 && (
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(r.amount)}</span>
                    )}
                    {r.receipt_path && (
                      <a
                        href={receiptUrl(r.receipt_path) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <Receipt size={12} />
                        Ver recibo
                      </a>
                    )}
                    {isActive && profile?.role === 'admin' && (
                      <button
                        onClick={() => deleteRecord(r)}
                        className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText size={18} className="text-slate-400 dark:text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resumo Financeiro</h2>
        </div>
        <div className="space-y-2">
          <SummaryRow label="Deslocamento" value={totalsByType.displacement} />
          <SummaryRow label="Combustível" value={totalsByType.fuel} />
          <SummaryRow label="Refeição" value={totalsByType.meal} />
          <SummaryRow label="Materiais" value={totalsByType.material} />
          <SummaryRow label="Outras despesas" value={totalsByType.expense} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <span className="text-base font-bold text-slate-900 dark:text-white">Total</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</span>
        </div>
      </Card>

      {isDone && activity.service_description && (
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks size={18} className="text-slate-400 dark:text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Serviço Realizado</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{activity.service_description}</p>
        </Card>
      )}

      {/* Finish Activity Modal */}
      <Modal open={finishModalOpen} onClose={() => setFinishModalOpen(false)} title="Finalizar Atividade" size="md">
        <div className="space-y-4">
          <Textarea
            label="Descrição do serviço realizado"
            value={serviceDescription}
            onChange={setServiceDescription}
            placeholder="Descreva o que foi feito..."
            required
            rows={4}
          />
          <Textarea
            label="Observações"
            value={observations}
            onChange={setObservations}
            placeholder="Observações adicionais..."
            rows={3}
          />
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            Ao finalizar, a atividade será marcada como concluída e não poderá ser reaberta.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setFinishModalOpen(false)}>Cancelar</Button>
          <Button variant="danger" onClick={finishActivity}>
            <Square size={18} />
            Finalizar
          </Button>
        </div>
      </Modal>

      {/* Record Modal */}
      <Modal
        open={recordModalType !== null}
        onClose={() => setRecordModalType(null)}
        title={recordModalType ? RECORD_CONFIG[recordModalType].label : ''}
        size="md"
      >
        <div className="space-y-4">
          {recordModalType === 'displacement' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de deslocamento</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DISPLACEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDisplacementOption(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${displacementOption === opt.value ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    {opt.icon}
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {recordModalType === 'displacement' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Veículo</label>
              <select
                value={selectedVehicleId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setSelectedVehicleId(id);
                  if (id) {
                    const v = vehicles.find((x) => x.id === id);
                    if (v) setOdometer(String(v.odometer));
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
              >
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>
                ))}
              </select>
            </div>
          )}
          {recordModalType === 'displacement' && (
            <Input
              label="Hodômetro (km)"
              type="number"
              value={odometer}
              onChange={setOdometer}
              placeholder="km atual do veículo"
            />
          )}
          {recordModalType !== 'displacement' && (
            <Textarea
              label="Descrição"
              value={recordDescription}
              onChange={setRecordDescription}
              placeholder={recordModalType ? RECORD_CONFIG[recordModalType].placeholder : ''}
              required
              rows={3}
            />
          )}
          {recordModalType && RECORD_CONFIG[recordModalType].hasAmount && (
            <Input
              label="Valor (R$)"
              type="number"
              value={recordAmount}
              onChange={setRecordAmount}
              placeholder="0,00"
            />
          )}
          {recordModalType && RECORD_CONFIG[recordModalType].hasAmount && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Foto do Recibo / Nota Fiscal
              </label>
              {recordPreview ? (
                <div className="relative inline-block">
                  <img
                    src={recordPreview}
                    alt="Pré-visualização do recibo"
                    className="h-40 w-auto rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-1 text-white shadow-md hover:bg-rose-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800/50">
                  <Upload size={24} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Toque para anexar a foto</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG ou WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { clearFile(); setRecordModalType(null); }}>Cancelar</Button>
          <Button onClick={saveRecord} disabled={saving || (recordModalType === 'displacement' ? (!displacementOption || !selectedVehicleId || !odometer.trim()) : !recordDescription.trim())}>
            {saving ? 'Salvando...' : 'Salvar registro'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(value)}</span>
    </div>
  );
}
