import { supabase } from '@/lib/supabase';

export interface VehicleFuelingInput { vehicle_id: string; odometer: number; liters: number; total_amount: number; fueling_date?: string; station?: string | null; notes?: string | null; created_by?: string | null; }
export interface VehicleMaintenanceInput { vehicle_id: string; type: string; description?: string | null; odometer: number; cost?: number; performed_at?: string; next_due_odometer?: number | null; next_due_date?: string | null; created_by?: string | null; }

export const vehicleOperationsService = {
  async addFueling(input: VehicleFuelingInput) {
    const { error } = await supabase.from('vehicle_fuelings').insert(input);
    if (error) throw error;
    const { error: vehicleError } = await supabase.from('vehicles').update({ odometer: input.odometer }).eq('id', input.vehicle_id).lt('odometer', input.odometer + 1);
    if (vehicleError) throw vehicleError;
  },
  async addMaintenance(input: VehicleMaintenanceInput) {
    const { error } = await supabase.from('vehicle_maintenance_events').insert(input);
    if (error) throw error;
    if (input.next_due_odometer) {
      const field = input.type === 'oleo' ? 'next_oil_change_odometer' : input.type === 'filtro' ? 'next_filter_change_odometer' : null;
      if (field) {
        const { error: updateError } = await supabase.from('vehicles').update({ [field]: input.next_due_odometer }).eq('id', input.vehicle_id);
        if (updateError) throw updateError;
      }
    }
  },
  async summary(vehicleId: string) {
    const [{ data: fuelings, error: fuelError }, { data: maintenance, error: maintenanceError }] = await Promise.all([
      supabase.from('vehicle_fuelings').select('*').eq('vehicle_id', vehicleId).order('fueling_date', { ascending: false }),
      supabase.from('vehicle_maintenance_events').select('*').eq('vehicle_id', vehicleId).order('performed_at', { ascending: false }),
    ]);
    if (fuelError) throw fuelError;
    if (maintenanceError) throw maintenanceError;
    return { fuelings: fuelings ?? [], maintenance: maintenance ?? [] };
  },
};
