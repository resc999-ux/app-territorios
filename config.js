/**
 * Configuración de la aplicación de Control Territorial (Rojas)
 * Lee credenciales desde window.__ENV__ (.env) con soporte de persistencia local en navegador.
 */

const DEFAULT_CONFIG = {
  supabaseUrl: 'https://fhczcoiolmrsrrlpxnee.supabase.co',
  rawSupabaseUrl: 'fhczcoiolmrsrrlpxnee.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoY3pjb2lvbG1yc3JybHB4bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTE3ODYsImV4cCI6MjEwNzIyNzc4Nn0.vQS-H4mnDYdgj1_S5rf6aXvVAcU_rlw433PTlJuxevE',

  mapCenter: [-34.1977, -60.7337], // Centro de Rojas, Buenos Aires
  defaultZoom: 15,
  storageKey: 'rojas_territorios_config'
};


function normalizeSupabaseUrl(url) {
  if (!url) return '';
  let cleanUrl = String(url).trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  // Limpiar /rest/v1 si fue ingresado por error
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/i, '');
  return cleanUrl.replace(/\/+$/, '');
}

function getConfig() {
  const env = (typeof window !== 'undefined' && window.__ENV__) ? window.__ENV__ : {};
  const envUrl = env.SUPABASE_URL || DEFAULT_CONFIG.rawSupabaseUrl;
  const envKey = env.SUPABASE_KEY || DEFAULT_CONFIG.supabaseKey;

  const currentDefaults = {
    ...DEFAULT_CONFIG,
    rawSupabaseUrl: envUrl,
    supabaseUrl: normalizeSupabaseUrl(envUrl),
    supabaseKey: envKey
  };

  try {
    const saved = localStorage.getItem(DEFAULT_CONFIG.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Si la clave guardada en el navegador difiere de la clave actual del código,
      // descartamos la config vieja para evitar Error 401 por credenciales desactualizadas.
      if (parsed.supabaseKey && parsed.supabaseKey !== DEFAULT_CONFIG.supabaseKey) {
        console.warn('⚠️ Config del navegador tiene una API Key diferente a la del código. Se descarta y se usa la del código.');
        localStorage.removeItem(DEFAULT_CONFIG.storageKey);
        return currentDefaults;
      }

      return {
        ...currentDefaults,
        ...parsed,
        supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl || parsed.rawSupabaseUrl || currentDefaults.supabaseUrl)
      };
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage, usando configuración base:', e);
  }

  return currentDefaults;
}

function saveConfig(newConfig) {
  const current = getConfig();
  const updated = {
    ...current,
    ...newConfig,
    supabaseUrl: normalizeSupabaseUrl(newConfig.supabaseUrl || newConfig.rawSupabaseUrl || current.supabaseUrl)
  };
  try {
    localStorage.setItem(DEFAULT_CONFIG.storageKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
  return updated;
}

function resetConfig() {
  try {
    localStorage.removeItem(DEFAULT_CONFIG.storageKey);
  } catch (e) {
    // Ignorar
  }
  return getConfig();
}

if (typeof window !== 'undefined') {
  window.AppConfig = {
    DEFAULT_CONFIG,
    normalizeSupabaseUrl,
    getConfig,
    saveConfig,
    resetConfig
  };
}
