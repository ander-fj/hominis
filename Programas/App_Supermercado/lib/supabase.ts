import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  market_id?: string;
  barcode?: string;
  created_at: string;
}

export interface Market {
  id: string;
  name: string;
  location?: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  market_id?: string;
  total_amount: number;
  items_count: number;
  completed_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}
