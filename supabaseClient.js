/**
 * Cliente de conexión a Supabase para Control Territorial (Rojas)
 * Diseñado a prueba de fallos: nunca interrumpe el renderizado de la interfaz ni rompe la pantalla.
 */

let supabaseInstance = null;
let currentConfig = null;

function getSupabase() {
  try {
    const config = window.AppConfig ? window.AppConfig.getConfig() : null;
    if (!config) {
      console.warn('Configuración no disponible aún para Supabase');
      return null;
    }

    const createClientFn = window.supabase?.createClient;
    if (!createClientFn) {
      console.warn('Librería de Supabase no cargada globalmente en window.supabase');
      return null;
    }

    // Recrear si la URL o la Key cambiaron
    if (!supabaseInstance || currentConfig?.supabaseUrl !== config.supabaseUrl || currentConfig?.supabaseKey !== config.supabaseKey) {
      supabaseInstance = createClientFn(config.supabaseUrl, config.supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      currentConfig = { ...config };
      console.log('🔗 Cliente de Supabase conectado con URL:', config.supabaseUrl);
    }

    return supabaseInstance;
  } catch (error) {
    console.warn('No se pudo inicializar cliente Supabase:', error);
    return null;
  }
}

/**
 * Prueba la conectividad con Supabase y verifica la tabla 'manzanas'
 */
async function testConnection() {
  try {
    const config = window.AppConfig ? window.AppConfig.getConfig() : null;
    if (!config) {
      return { success: false, message: 'Configuración no encontrada.', tableExists: false };
    }

    const client = getSupabase();
    if (!client) {
      return {
        success: false,
        message: 'No se pudo inicializar el cliente con las credenciales actuales.',
        tableExists: false
      };
    }

    const start = performance.now();
    const { count, error, status } = await client
      .from('manzanas')
      .select('*', { count: 'exact', head: true });

    const latency = Math.round(performance.now() - start);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return {
          success: true,
          tableExists: false,
          latency,
          message: 'Conectado a Supabase, pero la tabla "manzanas" no existe aún.'
        };
      }

      return {
        success: false,
        tableExists: false,
        latency,
        message: `Error de Supabase: ${error.message} (${error.code || status})`
      };
    }

    return {
      success: true,
      tableExists: true,
      totalRows: count,
      latency,
      message: `Conexión exitosa a Supabase. Se detectaron ${count ?? 'múltiples'} manzanas registradas (${latency}ms).`
    };
  } catch (err) {
    return {
      success: false,
      tableExists: false,
      message: `Error de red al conectar con Supabase: ${err.message}`
    };
  }
}

/**
 * Trae dinámicamente las manzanas de la base de datos de forma segura (hasta 2000)
 */
async function fetchManzanas() {
  try {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('manzanas')
      .select('*')
      .range(0, 1999);

    if (error) {
      console.warn('Aviso al consultar tabla manzanas:', error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Excepción al consultar manzanas:', err);
    return [];
  }
}

/**
 * Actualiza el estado o asignación de una manzana en Supabase
 */
async function updateManzana(manzanaId, fields) {
  try {
    const client = getSupabase();
    if (!client) throw new Error('Cliente Supabase no disponible');

    const updatePayload = {
      ...fields,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('manzanas')
      .update(updatePayload)
      .eq('id', manzanaId)
      .select();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Error en updateManzana:', err);
    throw err;
  }
}

/**
 * Trae la lista de conductores desde Supabase si existe
 */
async function fetchConductores() {
  try {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('conductores')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * Suscribe a eventos de actualización en tiempo real en la tabla de manzanas
 */
function subscribeToManzanas(onUpdate) {
  try {
    const client = getSupabase();
    if (!client) return null;

    return client
      .channel('manzanas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manzanas' }, (payload) => {
        console.log('⚡ Cambio en tiempo real recibido:', payload);
        if (typeof onUpdate === 'function') {
          onUpdate(payload);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('No se pudo establecer canal realtime:', e);
    return null;
  }
}

/**
 * Consulta las filas de historial S-13 en Supabase
 */
async function fetchHistorialS13() {
  try {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('historial_s13')
      .select('*')
      .range(0, 1999);

    if (error) {
      console.warn('Aviso al consultar historial_s13:', error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Excepción al consultar historial_s13:', err);
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.SupabaseService = {
    getSupabase,
    testConnection,
    fetchManzanas,
    updateManzana,
    fetchConductores,
    subscribeToManzanas,
    fetchHistorialS13,
    verificarYCcerrarFraccion
  };


  // FUNCIÓN DE CIERRE CÍCLICO AUTOMÁTICO S-13
  async function verificarYCcerrarFraccion(fraccionNombre, conductorNombre) {
    try {
      const client = getSupabase();
      if (!client) return false;

      // Obtener manzanas de la fraccion directamente desde Supabase
      const manzanas = await fetchManzanas();
      if (!Array.isArray(manzanas) || manzanas.length === 0) return false;

      const manzanasFraccion = manzanas.filter(m => {
        const props = m.coordenadas?.properties || m.coordenadas;
        return props?.fraccion === fraccionNombre || props?.name?.startsWith(fraccionNombre + ' -');
      });

      if (manzanasFraccion.length === 0) return false;

      const totales = manzanasFraccion.length;
      const completadas = manzanasFraccion.filter(
        m => m.status === 'Completed' || m.estado === 'completada'
      ).length;

      if (completadas < totales) return false;

      const fechaStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const anoActual = new Date().getFullYear();

      const { error: errHistorial } = await client
        .from('historial_s13')
        .insert([{
          numero_terr: fraccionNombre,
          asignado_1: conductorNombre || 'Grupo de Trabajo',
          fecha_asigno_1: fechaStr,
          fecha_completo_1: fechaStr,
          ultima_fecha_completo: fechaStr,
          ano_servicio: String(anoActual)
        }]);

      if (errHistorial) throw errHistorial;

      return true;
    } catch (error) {
      console.error("Error en el ciclo de cierre S-13:", error);
      return false;
    }
  }
}