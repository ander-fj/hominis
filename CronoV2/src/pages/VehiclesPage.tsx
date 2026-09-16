import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import { useMaintenance } from '@/context/MaintenanceContext';
import type { Vehicle } from '@/types';
import { Truck, Plus, Pencil, Trash2, Search, History, Droplet, Filter, AlertTriangle, Fuel, Wrench } from 'lucide-react';
import { vehicleOperationsService } from '@/modules/vehicles/services/vehicleOperations.service';
import { useAuth } from '@/context/AuthContext';

interface VehicleUsage {
  id: string;
  vehicle_id: string;
  type: string;
  description: string;
  odometer: number | null;
  created_at: string;
  created_by_profile: { name: string } | null;
  activity: {
    number: string;
    title: string;
    planned_date: string | null;
    project: { name: string } | null;
    work_order: { number: string; title: string } | null;
  } | null;
}

export function VehiclesPage() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [usageByVehicle, setUsageByVehicle] = useState<Record<string, VehicleUsage[]>>({});
  const { threshold: alertThreshold, setThreshold: setAlertThreshold, refresh: refreshMaintenance } = useMaintenance();
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const { user } = useAuth();
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelAmount, setFuelAmount] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('oleo');
  const [savingOperation, setSavingOperation] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: vehicleData }, { data: usageData }] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate'),
      supabase
        .from('activity_records')
        .select('id, vehicle_id, type, description, odometer, created_at, created_by_profile:profiles!activity_records_created_by_fkey(name), activity:activities(number, title, planned_date, project:projects(name), work_order:work_orders(number, title))')
        .not('vehicle_id', 'is', null)
        .order('created_at', { ascending: false }),
    ]);

    setVehicles((vehicleData as Vehicle[]) ?? []);
    const rawUsage = (usageData as {
      id: string;
      vehicle_id: string;
      type: string;
      description: string;
      odometer: number | null;
      created_at: string;
      created_by_profile: { name: string }[] | null;
      activity: {
        number: string;
        title: string;
        planned_date: string | null;
        project: { name: string }[] | null;
        work_order: { number: string; title: string }[] | null;
      }[] | null;
    }[]) ?? [];
    const grouped = rawUsage.reduce<Record<string, VehicleUsage[]>>((acc, usage) => {
      const activity = Array.isArray(usage.activity) ? usage.activity[0] ?? null : usage.activity;
      const normalized: VehicleUsage = {
        ...usage,
        created_by_profile: Array.isArray(usage.created_by_profile) ? usage.created_by_profile[0] ?? null : usage.created_by_profile,
        activity: activity ? {
          ...activity,
          project: Array.isArray(activity.project) ? activity.project[0] ?? null : activity.project,
          work_order: Array.isArray(activity.work_order) ? activity.work_order[0] ?? null : activity.work_order,
        } : null,
      };
      if (!acc[normalized.vehicle_id]) acc[normalized.vehicle_id] = [];
      acc[normalized.vehicle_id].push(normalized);
      return acc;
    }, {});
    setUsageByVehicle(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ active: true, odometer: 0, fuel_type: 'flex', next_oil_change_odometer: null, next_filter_change_odometer: null }); setFormModalOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setForm(v); setFormModalOpen(true); setDetailsVehicle(null); };

  const save = async () => {
    if (editing) await supabase.from('vehicles').update(form).eq('id', editing.id);
    else await supabase.from('vehicles').insert(form);
    setFormModalOpen(false);
    await load();
    await refreshMaintenance();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este veículo?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    setDetailsVehicle(null);
    await load();
    await refreshMaintenance();
  };

  const registerFueling = async () => {
    if (!detailsVehicle || !fuelLiters || !fuelAmount) return;
    setSavingOperation(true);
    try {
      await vehicleOperationsService.addFueling({ vehicle_id: detailsVehicle.id, odometer: detailsVehicle.odometer, liters: Number(fuelLiters), total_amount: Number(fuelAmount), created_by: user?.id });
      setFuelLiters(''); setFuelAmount(''); await load();
    } catch (error) { alert(error instanceof Error ? error.message : 'Não foi possível registrar o abastecimento.'); }
    finally { setSavingOperation(false); }
  };

  const registerMaintenance = async () => {
    if (!detailsVehicle) return;
    setSavingOperation(true);
    try {
      await vehicleOperationsService.addMaintenance({ vehicle_id: detailsVehicle.id, type: maintenanceType, odometer: detailsVehicle.odometer, cost: Number(maintenanceCost || 0), performed_at: new Date().toISOString(), created_by: user?.id });
      setMaintenanceCost(''); await load(); await refreshMaintenance();
    } catch (error) { alert(error instanceof Error ? error.message : 'Não foi possível registrar a manutenção.'); }
    finally { setSavingOperation(false); }
  };

  const filtered = vehicles.filter((v) => !search || v.plate.toLowerCase().includes(search.toLowerCase()) || v.model.toLowerCase().includes(search.toLowerCase()));
  const maintenanceAlerts = filtered.flatMap((vehicle) => [
    { vehicle, service: 'óleo', value: vehicle.next_oil_change_odometer },
    { vehicle, service: 'filtro', value: vehicle.next_filter_change_odometer },
  ]).filter((alert) => alert.value !== null && alert.value <= alert.vehicle.odometer + alertThreshold);

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Veículos</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie a frota</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Novo veículo</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa ou modelo..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <AlertTriangle size={16} className="text-amber-500" />
          <label htmlFor="alert-threshold" className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">Alertar quando faltar</label>
          <select
            id="alert-threshold"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(Number(e.target.value))}
            className="rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-sm text-slate-700 outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value={100}>100 km</option>
            <option value={500}>500 km</option>
            <option value={1000}>1.000 km</option>
            <option value={2000}>2.000 km</option>
            <option value={5000}>5.000 km</option>
            <option value={10000}>10.000 km</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck size={48} />} title="Nenhum veículo encontrado" />
      ) : (
        <Card className="min-w-0 overflow-hidden">
          {maintenanceAlerts.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {maintenanceAlerts.length} alerta{maintenanceAlerts.length > 1 ? 's' : ''} de manutenção — limite de {alertThreshold.toLocaleString('pt-BR')} km
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-400/80">
                    {maintenanceAlerts.slice(0, 3).map((alert, index) => (
                      <span key={`${alert.vehicle.id}-${alert.service}`}>
                        {index > 0 && ' · '}
                        {alert.vehicle.plate}: troca de {alert.service} {alert.value !== null && alert.value <= alert.vehicle.odometer ? 'vencida' : 'próxima'}
                      </span>
                    ))}
                    {maintenanceAlerts.length > 3 && ` · +${maintenanceAlerts.length - 3} alerta(s)`}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Veículo</th>
                  <th className="px-5 py-3 font-semibold">Placa</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Combustível</th>
                  <th className="px-5 py-3 font-semibold">Hodômetro</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Próx. troca</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                  <th className="hidden px-5 py-3 font-semibold lg:table-cell">Registros</th>
                  <th className="px-5 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((v) => {
                  const usageCount = usageByVehicle[v.id]?.length ?? 0;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setDetailsVehicle(v)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <Truck size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white">{v.model}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{v.brand ?? '-'} {v.year ?? ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{v.plate}</span>
                      </td>
                      <td className="hidden px-5 py-3 text-slate-600 dark:text-slate-300 md:table-cell">{v.fuel_type}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{v.odometer.toLocaleString('pt-BR')} km</td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        <div className="space-y-0.5 text-xs">
                          <MaintenanceLabel icon={<Droplet size={12} />} label="Óleo" value={v.next_oil_change_odometer} current={v.odometer} threshold={alertThreshold} />
                          <MaintenanceLabel icon={<Filter size={12} />} label="Filtro" value={v.next_filter_change_odometer} current={v.odometer} threshold={alertThreshold} />
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <Badge className={v.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}>
                          {v.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <History size={14} className="text-slate-400 dark:text-slate-500" />
                          {usageCount}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); remove(v.id); }}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Vehicle details modal */}
      <Modal
        open={detailsVehicle !== null}
        onClose={() => setDetailsVehicle(null)}
        title={detailsVehicle ? `${detailsVehicle.model} — ${detailsVehicle.plate}` : ''}
        size="lg"
      >
        {detailsVehicle && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField label="Modelo" value={detailsVehicle.model} />
              <DetailField label="Placa" value={detailsVehicle.plate} mono />
              <DetailField label="Marca" value={detailsVehicle.brand ?? '-'} />
              <DetailField label="Ano" value={detailsVehicle.year?.toString() ?? '-'} />
              <DetailField label="Cor" value={detailsVehicle.color ?? '-'} />
              <DetailField label="Combustível" value={detailsVehicle.fuel_type} />
              <DetailField label="Hodômetro" value={`${detailsVehicle.odometer.toLocaleString('pt-BR')} km`} />
              <DetailField label="Status" value={detailsVehicle.active ? 'Ativo' : 'Inativo'} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MaintenanceCard icon={<Droplet size={18} />} title="Próxima troca de óleo" value={detailsVehicle.next_oil_change_odometer} current={detailsVehicle.odometer} threshold={alertThreshold} />
              <MaintenanceCard icon={<Filter size={18} />} title="Próxima troca de filtro" value={detailsVehicle.next_filter_change_odometer} current={detailsVehicle.odometer} threshold={alertThreshold} />
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-800 dark:text-white"><Fuel size={16}/> Registrar abastecimento</div>
                <div className="grid grid-cols-2 gap-2"><Input label="Litros" type="number" value={fuelLiters} onChange={setFuelLiters}/><Input label="Valor (R$)" type="number" value={fuelAmount} onChange={setFuelAmount}/></div>
                <Button className="mt-3 w-full" size="sm" disabled={savingOperation || !fuelLiters || !fuelAmount} onClick={registerFueling}>Salvar abastecimento</Button>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-800 dark:text-white"><Wrench size={16}/> Registrar manutenção</div>
                <select value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)} className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <option value="oleo">Troca de óleo</option><option value="filtro">Filtro</option><option value="pneus">Pneus</option><option value="freios">Freios</option><option value="revisao">Revisão</option><option value="corretiva">Corretiva</option>
                </select>
                <Input label="Custo (R$)" type="number" value={maintenanceCost} onChange={setMaintenanceCost}/>
                <Button className="mt-3 w-full" size="sm" variant="secondary" disabled={savingOperation} onClick={registerMaintenance}>Salvar manutenção</Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => openEdit(detailsVehicle)}><Pencil size={14} /> Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(detailsVehicle.id)} className="text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Excluir</Button>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="mb-3 flex items-center gap-2">
                <History size={18} className="text-slate-400 dark:text-slate-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Histórico de uso</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {usageByVehicle[detailsVehicle.id]?.length ?? 0}
                </span>
              </div>

              {(usageByVehicle[detailsVehicle.id]?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Nenhum registro de uso para este veículo.</p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {usageByVehicle[detailsVehicle.id].map((u) => (
                    <div key={u.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {u.activity?.number ?? '—'} · {u.activity?.title ?? ''}
                        </span>
                        {u.odometer !== null && (
                          <span className="font-mono text-slate-500 dark:text-slate-400">{u.odometer.toLocaleString('pt-BR')} km</span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">{u.description}</p>
                      <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                        Usuário: <span className="font-medium">{u.created_by_profile?.name ?? 'Não informado'}</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {u.activity?.project?.name
                          ? <>Obra: <span className="font-medium">{u.activity.project.name}</span></>
                          : u.activity?.work_order
                            ? <>O.S.: <span className="font-medium">{u.activity.work_order.number} — {u.activity.work_order.title}</span></>
                            : 'Obra / O.S.: Não informada'}
                      </p>
                      <p className="mt-1 text-slate-400 dark:text-slate-500">
                        {new Date(u.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Form modal (new / edit) */}
      <Modal open={formModalOpen} onClose={() => setFormModalOpen(false)} title={editing ? 'Editar veículo' : 'Novo veículo'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Placa" value={form.plate ?? ''} onChange={(v) => setForm({ ...form, plate: v.toUpperCase() })} required />
          <Input label="Modelo" value={form.model ?? ''} onChange={(v) => setForm({ ...form, model: v })} required />
          <Input label="Marca" value={form.brand ?? ''} onChange={(v) => setForm({ ...form, brand: v })} />
          <Input label="Ano" type="number" value={form.year?.toString() ?? ''} onChange={(v) => setForm({ ...form, year: v ? parseInt(v) : null })} />
          <Input label="Cor" value={form.color ?? ''} onChange={(v) => setForm({ ...form, color: v })} />
          <Input label="Combustível" value={form.fuel_type ?? 'flex'} onChange={(v) => setForm({ ...form, fuel_type: v })} />
          <Input label="Hodômetro (km)" type="number" value={form.odometer?.toString() ?? '0'} onChange={(v) => setForm({ ...form, odometer: parseInt(v) || 0 })} />
          <Input label="Próx. troca óleo (km)" type="number" value={form.next_oil_change_odometer?.toString() ?? ''} onChange={(v) => setForm({ ...form, next_oil_change_odometer: v ? parseInt(v) : null })} />
          <Input label="Próx. troca filtro (km)" type="number" value={form.next_filter_change_odometer?.toString() ?? ''} onChange={(v) => setForm({ ...form, next_filter_change_odometer: v ? parseInt(v) : null })} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setFormModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
        </div>
      </Modal>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function maintenanceStatus(value: number | null, current: number, threshold = 1000): { text: string; tone: string } {
  if (value === null) return { text: 'Não definido', tone: 'text-slate-400 dark:text-slate-500' };
  const remaining = value - current;
  if (remaining <= 0) return { text: 'Vencido', tone: 'text-rose-600 dark:text-rose-400' };
  if (remaining <= threshold) return { text: `Em ${remaining.toLocaleString('pt-BR')} km`, tone: 'text-amber-600 dark:text-amber-400' };
  return { text: `Em ${remaining.toLocaleString('pt-BR')} km`, tone: 'text-emerald-600 dark:text-emerald-400' };
}

function MaintenanceLabel({ icon, label, value, current, threshold }: { icon: React.ReactNode; label: string; value: number | null; current: number; threshold?: number }) {
  const status = maintenanceStatus(value, current, threshold);
  return (
    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
      {icon}
      <span>{label}:</span>
      <span className={`font-medium ${status.tone}`}>
        {value !== null ? `${value.toLocaleString('pt-BR')} km` : '—'}
      </span>
    </div>
  );
}

function MaintenanceCard({ icon, title, value, current, threshold }: { icon: React.ReactNode; title: string; value: number | null; current: number; threshold?: number }) {
  const status = maintenanceStatus(value, current, threshold);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        {icon}
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-1.5 text-lg font-semibold text-slate-900 dark:text-white">
        {value !== null ? `${value.toLocaleString('pt-BR')} km` : 'Não definido'}
      </p>
      <p className={`mt-0.5 text-xs font-medium ${status.tone}`}>{status.text}</p>
    </div>
  );
}
