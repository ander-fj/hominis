import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://muvjwzzvbhcaixzzjdow.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dmp3enp2YmhjYWl4enpqZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDk2OTIsImV4cCI6MjA3NjcyNTY5Mn0.1_DG9G2lUxX5mQA8XnClNjaggc8ODjmXs6HFS3doO9U';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
