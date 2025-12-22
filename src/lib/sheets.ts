import { supabase } from './supabase';

export async function syncWithGoogleSheets(sheetUrl: string): Promise<void> {
  try {
    const response = await fetch(`/api/sheets-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetUrl }),
    });

    if (!response.ok) {
      throw new Error('Erro ao sincronizar com Google Sheets');
    }

    await supabase
      .from('sheets_sync_config')
      .update({ last_sync: new Date().toISOString() })
      .eq('sheet_url', sheetUrl);

  } catch (error) {
    console.error('Erro na sincronização:', error);
    throw error;
  }
}

export function getSheetIdFromUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function validateSheetUrl(url: string): boolean {
  return url.includes('docs.google.com/spreadsheets/d/');
}

export async function mockSheetSync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Sincronização simulada com Google Sheets');
      resolve();
    }, 1500);
  });
}
