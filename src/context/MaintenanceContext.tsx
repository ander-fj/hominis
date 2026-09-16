import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface VehicleMaintenance {
  id: string;
  odometer: number;
  next_oil_change_odometer: number | null;
  next_filter_change_odometer: number | null;
}

interface MaintenanceContextValue {
  threshold: number;
  setThreshold: (value: number) => void;
  alertCount: number;
  vehicles: VehicleMaintenance[];
  refresh: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextValue | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [threshold, setThresholdState] = useState(1000);
  const [vehicles, setVehicles] = useState<VehicleMaintenance[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  const computeAlerts = useCallback((list: VehicleMaintenance[], value: number) => {
    const count = list.reduce((total, vehicle) => {
      const oilAlert = vehicle.next_oil_change_odometer !== null
        && vehicle.next_oil_change_odometer <= vehicle.odometer + value;
      const filterAlert = vehicle.next_filter_change_odometer !== null
        && vehicle.next_filter_change_odometer <= vehicle.odometer + value;
      return total + Number(oilAlert) + Number(filterAlert);
    }, 0);
    setAlertCount(count);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('id, odometer, next_oil_change_odometer, next_filter_change_odometer');
    const list = (data as VehicleMaintenance[]) ?? [];
    setVehicles(list);
    setAlertCount(0);
  }, []);

  useEffect(() => {
    if (!profile) {
      setVehicles([]);
      setAlertCount(0);
      setThresholdState(1000);
      return;
    }

    const storedThreshold = window.localStorage.getItem(`maintenance-alert-threshold:${profile.id}`);
    const savedThreshold = storedThreshold ? Number(storedThreshold) : profile.maintenance_alert_threshold;
    setThresholdState(Number.isFinite(savedThreshold) ? savedThreshold : 1000);
    refresh();
  }, [profile, refresh]);

  useEffect(() => {
    computeAlerts(vehicles, threshold);
  }, [vehicles, threshold, computeAlerts]);

  const setThreshold = useCallback(async (value: number) => {
    setThresholdState(value);
    if (!profile) return;

    window.localStorage.setItem(`maintenance-alert-threshold:${profile.id}`, String(value));
    await supabase
      .from('profiles')
      .update({ maintenance_alert_threshold: value })
      .eq('id', profile.id);
  }, [profile]);

  return (
    <MaintenanceContext.Provider value={{ threshold, setThreshold, alertCount, vehicles, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance must be used within MaintenanceProvider');
  return ctx;
}
