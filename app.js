/**
 * Aplicación de Control Territorial para Conductores de Reparto en Rojas
 * Orquestador principal de mapa, datos dinámicos y visualización GeoJSON.
 * Diseñado con protección total contra fallos para que la pantalla NUNCA se quede en blanco.
 */

(function () {
  // 1. Acceso seguro a servicios y módulos globales con fallbacks
  const AppConfig = window.AppConfig || {};
  const ManzanasData = window.ManzanasData || {};
  const SupabaseService = window.SupabaseService || {};


  const DEFAULT_CONFIG = AppConfig.DEFAULT_CONFIG || {
    supabaseUrl: 'https://fhczcoiolmrsrrlpxnee.supabase.co',
    rawSupabaseUrl: 'fhczcoiolmrsrrlpxnee.supabase.co',
    supabaseKey: 'sb_publishable_fk_-oGNjGBW9sPBxGBuiQg_k8TnZDN',
    mapCenter: [-34.1977, -60.7337],
    defaultZoom: 15
  };



  const getConfig = () => DEFAULT_CONFIG;

  const saveConfig = AppConfig.saveConfig || (() => DEFAULT_CONFIG);
  const normalizeSupabaseUrl = AppConfig.normalizeSupabaseUrl || ((u) => u);

  const CONDUCTORES_DEFAULT = Array.isArray(ManzanasData.CONDUCTORES_DEFAULT) ? ManzanasData.CONDUCTORES_DEFAULT : [];
  const MANZANAS_DEFAULT = Array.isArray(ManzanasData.MANZANAS_DEFAULT) ? ManzanasData.MANZANAS_DEFAULT : [];
  const ESTADO_COLORES = ManzanasData.ESTADO_COLORES || {
    pendiente: { fill: '#f59e0b', border: '#d97706', label: 'Pendiente', badgeClass: 'badge-warning' },
    en_reparto: { fill: '#3b82f6', border: '#2563eb', label: 'En Reparto', badgeClass: 'badge-info' },
    completada: { fill: '#10b981', border: '#059669', label: 'Entregada', badgeClass: 'badge-success' },
    alerta: { fill: '#ef4444', border: '#dc2626', label: 'Con Alerta', badgeClass: 'badge-danger' }
  };

  const testConnection = SupabaseService.testConnection || (async () => ({ success: false, message: 'No configurado' }));
  const fetchManzanas = SupabaseService.fetchManzanas || (async () => []);
  const updateManzana = SupabaseService.updateManzana || (async () => { });
  const fetchConductores = SupabaseService.fetchConductores || (async () => []);
  const subscribeToManzanas = SupabaseService.subscribeToManzanas || (() => null);

  // 2. Estado global de la aplicación
  const state = {
    manzanas: [...MANZANAS_DEFAULT],
    conductores: [...CONDUCTORES_DEFAULT],
    activeFilter: 'todas',
    searchQuery: '',
    selectedManzanaId: null,
    activeTab: 'manzanas',
    map: null,
    manzanasFeatureGroup: null,
    geoJsonLayersMap: new Map(),
    conductorMarkers: new Map(),
    tileLayer: null,
    tileStyle: 'streets',
    isUsingSupabase: false,
    connectionStatus: 'checking',
    itemsPerPage: 60,
    currentPage: 1
  };

  // Exponer estado global para módulo de reportes S-13
  window.AppState = state;

  // ========================================================
  // INICIALIZACIÓN ROBUSTA A PRUEBA DE ERRORES
  // ========================================================
  function init() {
    console.log('🚀 Inicializando Control Territorial Rojas...');

    // 1. Inicializar mapa Leaflet
    try {
      initMap();
    } catch (err) {
      console.error('Error al inicializar mapa:', err);
    }

    // 2. Configurar eventos de la interfaz
    try {
      setupEventListeners();
    } catch (err) {
      console.error('Error al inicializar eventos:', err);
    }

    // 3. Renderizar pantalla de inmediato con datos locales / caché
    try {
      renderAll(false);
    } catch (err) {
      console.error('Error en primer renderAll:', err);
    }

    // 4. Intentar sincronización con Supabase en segundo plano sin bloquear la UI
    setTimeout(() => {
      checkAndSyncData().catch(e => {
        console.warn('Sincronización en segundo plano falló de forma controlada:', e);
      });
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ========================================================
  // MAPA LEAFLET
  // ========================================================
  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      console.error('Contenedor #map no encontrado en el DOM');
      return false;
    }

    if (typeof L === 'undefined') {
      console.error('Librería Leaflet no cargada');
      mapEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;flex-direction:column;gap:12px;padding:20px;text-align:center;">
          <div style="font-size:2rem;">🗺️</div>
          <div style="font-weight:600;color:#f8fafc;">Cargando mapa...</div>
          <small>Si no carga, verificá la conexión para obtener los estilos de Leaflet.</small>
        </div>
      `;
      return false;
    }

    // Evitar reinicializar si ya existe
    if (state.map) {
      return true;
    }

    const config = getConfig();

    state.map = L.map('map', {
      center: config.mapCenter || [-34.1977, -60.7337],
      zoom: config.defaultZoom || 15,
      zoomControl: false,
      preferCanvas: true // Renderizado Canvas nativo para máximo rendimiento
    });

    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // Grupo de polígonos
    state.manzanasFeatureGroup = L.featureGroup().addTo(state.map);

    // Aplicar mapa base libre de bloqueos
    applyMapTiles('streets');

    window.addEventListener('resize', () => {
      if (state.map) state.map.invalidateSize();
    });

    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 250);

    return true;
  }

  function applyMapTiles(style) {
    if (!state.map) return;

    if (state.tileLayer) {
      state.map.removeLayer(state.tileLayer);
    }

    if (style === 'satellite') {
      state.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &copy; DigitalGlobe',
        maxZoom: 19
      });
    } else {
      state.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DeLorme, HERE, OpenStreetMap',
        maxZoom: 19
      });
    }

    state.tileLayer.addTo(state.map);
    state.tileStyle = style;
  }

  // ========================================================
  // EXTRACTOR Y REPARADOR DE GEOMETRÍAS GEOJSON
  // ========================================================
  function extractGeoJSON(manzana) {
    if (!manzana) return null;
    try {
      let raw = manzana.coordenadas || manzana.geojson || manzana.geometry || manzana.geom || manzana.the_geom;
      if (!raw) return null;

      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch (e) {
          return null;
        }
      }

      if (!raw) return null;

      if (raw.type === 'Feature' && raw.geometry) {
        raw = raw.geometry;
      }

      if (raw.type === 'Polygon' || raw.type === 'MultiPolygon') {
        return fixGeoJSONCoordinateOrder(raw);
      }

      if (Array.isArray(raw)) {
        let ring = raw;
        if (Array.isArray(raw[0]) && Array.isArray(raw[0][0])) {
          ring = raw[0];
        }

        const normalizedRing = ring.map(pt => {
          if (!Array.isArray(pt) || pt.length < 2) return null;
          let [p0, p1] = pt;
          if (typeof p0 !== 'number' || typeof p1 !== 'number') {
            p0 = parseFloat(p0);
            p1 = parseFloat(p1);
          }
          if (isNaN(p0) || isNaN(p1)) return null;

          // Si p0 es latitud (~ -34) y p1 es longitud (~ -60), convertir a [lng, lat]
          if (Math.abs(p0) < 45 && Math.abs(p1) > 55) {
            return [p1, p0];
          }
          return [p0, p1];
        }).filter(Boolean);

        if (normalizedRing.length < 3) return null;

        // Cerrar anillo si está abierto
        const first = normalizedRing[0];
        const last = normalizedRing[normalizedRing.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          normalizedRing.push([first[0], first[1]]);
        }

        return {
          type: 'Polygon',
          coordinates: [normalizedRing]
        };
      }
    } catch (err) {
      console.warn('Excepción al extraer GeoJSON de manzana:', err);
    }
    return null;
  }

  function fixGeoJSONCoordinateOrder(geo) {
    if (!geo) return null;
    function fixRing(ring) {
      if (!Array.isArray(ring)) return [];
      return ring.map(pt => {
        if (!Array.isArray(pt) || pt.length < 2) return pt;
        let [p0, p1] = pt;
        if (Math.abs(p0) < 45 && Math.abs(p1) > 55) {
          return [p1, p0];
        }
        return [p0, p1];
      });
    }

    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
      return {
        ...geo,
        coordinates: geo.coordinates.map(fixRing)
      };
    } else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
      return {
        ...geo,
        coordinates: geo.coordinates.map(polygon => Array.isArray(polygon) ? polygon.map(fixRing) : polygon)
      };
    }
    return geo;
  }

  function normalizeManzanaRecord(raw, index) {
    if (!raw) return null;
    const id = raw.id || raw.gid || raw.ogc_fid || raw.cartodb_id || `manzana-${index}`;
    const numero = raw.numero_manzana || raw.manzana || raw.nro_manzana || raw.cod_manzana || raw.nombre || raw.name || `M-${index + 1}`;
    const barrio = raw.barrio || raw.seccion || raw.circ || raw.zona || 'Rojas';
    const calles = raw.calles || raw.calle || raw.domicilio || raw.direccion || raw.descripcion || 'Sin referencia';
    const estado = (raw.estado && ESTADO_COLORES[raw.estado]) ? raw.estado : 'pendiente';
    const total_paquetes = Number(raw.total_paquetes ?? raw.paquetes ?? 0) || 0;
    const paquetes_entregados = Number(raw.paquetes_entregados ?? 0) || 0;
    const conductor_id = raw.conductor_id || raw.repartidor_id || null;
    const notas = raw.notas || '';

    return {
      ...raw,
      id: String(id),
      numero_manzana: String(numero),
      barrio: String(barrio),
      calles: String(calles),
      estado,
      total_paquetes,
      paquetes_entregados,
      conductor_id,
      notas
    };
  }

  // ========================================================
  // RENDERIZADO DE CAPAS EN EL MAPA
  // ========================================================
  function renderMapLayers(shouldFitBounds = false) {
    if (!state.map || !state.manzanasFeatureGroup) return;

    try {
      state.manzanasFeatureGroup.clearLayers();
      state.geoJsonLayersMap.clear();

      state.conductorMarkers.forEach(m => {
        try { state.map.removeLayer(m); } catch (e) { }
      });
      state.conductorMarkers.clear();

      let validLayersCount = 0;

      // 1. Dibujar manzanas
      state.manzanas.forEach(manzana => {
        if (!manzana) return;
        const geoData = extractGeoJSON(manzana);
        if (!geoData) return;

        const estadoInfo = ESTADO_COLORES[manzana.estado] || ESTADO_COLORES.pendiente;
        const isSelected = state.selectedManzanaId === manzana.id;

        try {
          // Leaflet con preferCanvas: true renderiza automáticamente en Canvas
          const geoLayer = L.geoJSON(geoData, {
            style: {
              color: isSelected ? '#38bdf8' : estadoInfo.border,
              fillColor: estadoInfo.fill,
              fillOpacity: isSelected ? 0.75 : 0.38,
              weight: isSelected ? 3 : 1.5,
              dashArray: manzana.estado === 'pendiente' ? '4, 4' : null
            }
          });

          geoLayer.bindTooltip(`
            <strong>${manzana.numero_manzana}</strong><br/>
            <small>Barrio: ${manzana.barrio} | Estado: ${estadoInfo.label}</small><br/>
            <small>📦 Paquetes: ${manzana.paquetes_entregados}/${manzana.total_paquetes}</small>
          `, { sticky: true, opacity: 0.95 });

          geoLayer.on('click', () => {
            selectManzana(manzana.id);
          });

          state.manzanasFeatureGroup.addLayer(geoLayer);
          state.geoJsonLayersMap.set(manzana.id, geoLayer);
          validLayersCount++;
        } catch (err) {
          console.warn('Aviso: no se pudo dibujar polígono de manzana:', manzana.id);
        }
      });

      if (shouldFitBounds && validLayersCount > 0) {
        try {
          const bounds = state.manzanasFeatureGroup.getBounds();
          if (bounds && bounds.isValid()) {
            state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
          }
        } catch (e) {
          console.warn('No se pudo ajustar zoom a bounds:', e);
        }
      }

      // 2. Dibujar conductores
      state.conductores.forEach(conductor => {
        if (!conductor || !conductor.posicion) return;

        try {
          const iconHtml = `
            <div style="
              background-color: ${conductor.color || '#3b82f6'};
              width: 34px;
              height: 34px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 16px;
              border: 2px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.6);
              cursor: pointer;
            ">
              🛵
            </div>
          `;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'driver-map-marker',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });

          const marker = L.marker(conductor.posicion, { icon: customIcon });
          marker.bindPopup(`
            <div class="popup-container">
              <div class="popup-title">${conductor.nombre}</div>
              <div class="popup-calles">${conductor.vehiculo} • ${conductor.telefono || 'Sin teléfono'}</div>
              <span class="badge badge-info">Conductor Activo</span>
            </div>
          `);

          marker.addTo(state.map);
          state.conductorMarkers.set(conductor.id, marker);
        } catch (err) {
          console.warn('No se pudo dibujar marcador de conductor:', err);
        }
      });
    } catch (e) {
      console.error('Error general en renderMapLayers:', e);
    }
  }

  // ========================================================
  // SINCRONIZACIÓN Y CONSULTAS A SUPABASE
  // ========================================================
  async function checkAndSyncData() {
    updateStatusBadge('checking', 'Sincronizando...');

    try {
      // 1. Intentar traer directamente las manzanas reales
      const remoteManzanas = await fetchManzanas();

      if (remoteManzanas && remoteManzanas.length > 0) {
        state.manzanas = remoteManzanas.map(normalizeManzanaRecord).filter(Boolean);
        state.isUsingSupabase = true;

        updateStatusBadge('connected', `🟢 Conectado (${state.manzanas.length} Manzanas)`);
        showToast(`✅ Se cargaron exitosamente ${state.manzanas.length} manzanas de Rojas`, 'success');

        const remoteConductores = await fetchConductores();
        if (remoteConductores && remoteConductores.length > 0) {
          state.conductores = remoteConductores;
        }

        renderAll(true);
        subscribeToManzanas(handleRealtimeUpdate);
        return;
      }
    } catch (err) {
      console.warn('Aviso: no se obtuvieron datos en primer intento remoto:', err);
    }

    // 2. Si no se obtuvieron datos remotos, diagnosticar estado de conexión
    try {
      const testResult = await testConnection();
      if (testResult.success && testResult.tableExists) {
        updateStatusBadge('connected', '🟢 Supabase Conectado');
        state.isUsingSupabase = true;
      } else {
        state.isUsingSupabase = false;
        const config = getConfig();
        const isPlaceholder = config.rawSupabaseUrl === 'supabase.co' || config.supabaseUrl.includes('//supabase.co');

        const badgeText = isPlaceholder
          ? '🟡 Configurar URL de Proyecto'
          : '🟡 Modo Local (Sin conexión remota)';

        updateStatusBadge('fallback', badgeText);

        if (isPlaceholder) {
          showToast('💡 Tu URL en .env es "supabase.co". Ingresá la URL de tu proyecto en Ajustes (⚙️) para ver las 695 manzanas.', 'info');
        } else {
          showToast(`Aviso de conexión: ${testResult.message}`, 'info');
        }
      }
    } catch (e) {
      updateStatusBadge('fallback', '🟡 Modo Local (Offline)');
    }

    // Mantener la pantalla visible con datos locales
    renderAll(false);
  }

  function handleRealtimeUpdate(payload) {
    if (!payload || !payload.new) return;
    const normalized = normalizeManzanaRecord(payload.new, 0);
    if (!normalized) return;

    const idx = state.manzanas.findIndex(m => String(m.id) === String(normalized.id));
    if (idx !== -1) {
      state.manzanas[idx] = { ...state.manzanas[idx], ...normalized };
      renderAll(false);
      showToast(`⚡ Manzana ${normalized.numero_manzana} actualizada`, 'info');
    }
  }

  // ========================================================
  // INTERFAZ Y RENDERIZADO
  // ========================================================
  function renderAll(shouldFitBounds = false) {
    try {
      renderStats();
    } catch (e) {
      console.warn('Error en renderStats:', e);
    }

    try {
      renderSidebarList();
    } catch (e) {
      console.warn('Error en renderSidebarList:', e);
    }

    try {
      renderMapLayers(shouldFitBounds);
    } catch (e) {
      console.warn('Error en renderMapLayers:', e);
    }
  }

  function renderStats() {
    const total = state.manzanas.length;
    const pendientes = state.manzanas.filter(m => m && m.estado === 'pendiente').length;
    const enReparto = state.manzanas.filter(m => m && m.estado === 'en_reparto').length;
    const completadas = state.manzanas.filter(m => m && m.estado === 'completada').length;

    const elTotal = document.getElementById('stat-total');
    const elPend = document.getElementById('stat-pendientes');
    const elRep = document.getElementById('stat-reparto');
    const elComp = document.getElementById('stat-completadas');

    if (elTotal) elTotal.textContent = total;
    if (elPend) elPend.textContent = pendientes;
    if (elRep) elRep.textContent = enReparto;
    if (elComp) elComp.textContent = completadas;
  }

  function renderSidebarList() {
    const container = document.getElementById('sidebar-items-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.activeTab === 'manzanas') {
      renderManzanasList(container);
    } else {
      renderConductoresList(container);
    }
  }

  function renderManzanasList(container) {
    const filtered = state.manzanas.filter(m => {
      if (!m) return false;
      if (state.activeFilter !== 'todas' && m.estado !== state.activeFilter) {
        return false;
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchNum = String(m.numero_manzana || '').toLowerCase().includes(q);
        const matchCalles = String(m.calles || '').toLowerCase().includes(q);
        const matchBarrio = String(m.barrio || '').toLowerCase().includes(q);
        return matchNum || matchCalles || matchBarrio;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
          <p>No se encontraron manzanas con los filtros actuales.</p>
        </div>
      `;
      return;
    }

    const counterHeader = document.createElement('div');
    counterHeader.style.cssText = 'font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px; padding: 0 4px; display: flex; justify-content: space-between; align-items: center;';
    counterHeader.innerHTML = `
      <span>Mostrando ${Math.min(filtered.length, state.currentPage * state.itemsPerPage)} de ${filtered.length} manzanas</span>
      ${state.isUsingSupabase ? '<span style="color: #34d399; font-weight: 600;">En línea</span>' : ''}
    `;
    container.appendChild(counterHeader);

    const visibleItems = filtered.slice(0, state.currentPage * state.itemsPerPage);

    visibleItems.forEach(manzana => {
      const estadoInfo = ESTADO_COLORES[manzana.estado] || ESTADO_COLORES.pendiente;
      const conductor = state.conductores.find(c => c && String(c.id) === String(manzana.conductor_id));
      const isSelected = state.selectedManzanaId === manzana.id;

      const card = document.createElement('div');
      card.className = `manzana-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="manzana-card-header">
          <span class="manzana-num">${manzana.numero_manzana}</span>
          <span class="badge ${estadoInfo.badgeClass}">${estadoInfo.label}</span>
        </div>
        <div class="manzana-calles">${manzana.barrio} • ${manzana.calles || 'Sin referencia'}</div>
        <div class="manzana-card-footer">
          <div class="driver-tag">
            <span class="driver-color-bullet" style="background-color: ${conductor?.color || '#64748b'};"></span>
            <span>${conductor ? conductor.nombre : 'Sin asignar'}</span>
          </div>
          <span class="package-count">📦 ${manzana.paquetes_entregados}/${manzana.total_paquetes}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectManzana(manzana.id);
      });

      container.appendChild(card);
    });

    if (filtered.length > state.currentPage * state.itemsPerPage) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn-secondary';
      loadMoreBtn.style.cssText = 'width: 100%; margin-top: 10px; font-size: 0.8rem; padding: 10px;';
      loadMoreBtn.textContent = `Cargar más manzanas (${filtered.length - state.currentPage * state.itemsPerPage} restantes)...`;
      loadMoreBtn.addEventListener('click', () => {
        state.currentPage++;
        renderSidebarList();
      });
      container.appendChild(loadMoreBtn);
    }
  }

  function renderConductoresList(container) {
    if (!container) return;
    container.innerHTML = '';

    const listaConductores = state.conductores || [];
    listaConductores.forEach(conductor => {
      if (!conductor) return;

      // Contar cuántas manzanas tiene asignadas este conductor actualmente
      const manzanasAsignadas = state.manzanas.filter(m => {
        const condActual = m.conductor_actual || m.properties?.conductor_actual;
        return String(condActual) === String(conductor.codigo_conductor) || String(condActual) === String(conductor.nombre);
      });

      const card = document.createElement('div');
      card.className = 'driver-card';
      card.innerHTML = `
      <div class="driver-card-header">
        
          <div class="driver-avatar" style="background-color: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            ${(conductor.nombre || 'C').charAt(0)}
          </div>
          <div>
            <div class="driver-name">${conductor.nombre}</div>
            <div class="driver-vehicle" style="color: #94a3b8; font-size: 0.85rem;">Código: ${conductor.codigo_conductor || 'S/C'}</div>
          </div>
        </div>
        <span class="badge badge-info">Manzanas: ${manzanasAsignadas.length}</span>
      </div>
    `;
      container.appendChild(card);
    });
  }



  // ========================================================
  // SELECCIÓN Y MODAL DE MANZANAS
  // ========================================================
  function selectManzana(manzanaId) {
    state.selectedManzanaId = manzanaId;
    const manzana = state.manzanas.find(m => m && String(m.id) === String(manzanaId));
    if (!manzana) return;

    const layer = state.geoJsonLayersMap.get(manzanaId);
    if (layer && state.map) {
      try {
        state.map.flyToBounds(layer.getBounds(), { padding: [60, 60], duration: 0.8, maxZoom: 17 });
      } catch (e) { }
    }

    openManzanaModal(manzana);
    renderAll(false);
  }

  function openManzanaModal(manzana) {
    const modal = document.getElementById('modal-manzana');
    if (!modal) return;
    document.getElementById('modal-m-title').textContent = manzana.nombre_manzana || 'Manzana Sin Nombre';
    document.getElementById('modal-m-estado').value = manzana.status || manzana.estado || 'pendiente';
    if (document.getElementById('modal-m-observaciones')) {
      document.getElementById('modal-m-observaciones').value = manzana.observaciones || manzana.notas || '';
    }

    const selectConductor = document.getElementById('modal-m-conductor');
    if (selectConductor) {
      selectConductor.innerHTML = '<option value="">-- Sin asignar --</option>';
      const listaConductores = state.conductores || [];
      listaConductores.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.codigo_conductor || c.nombre || '';
        opt.textContent = c.nombre + (c.codigo_conductor ? ` (${c.codigo_conductor})` : '');
        if (String(c.codigo_conductor) === String(manzana.conductor_actual)) {
          opt.selected = true;
        }
        selectConductor.appendChild(opt);
      });
    }


    modal.classList.add('open');
  }

  async function handleSaveManzana() {
    const manzanaId = state.selectedManzanaId;
    if (!manzanaId) return;

    const updatedFields = {
      barrio: document.getElementById('modal-m-barrio').value,
      calles: document.getElementById('modal-m-calles').value,
      estado: document.getElementById('modal-m-estado').value,
      conductor_id: document.getElementById('modal-m-conductor').value || null,

      paquetes_entregados: parseInt(document.getElementById('modal-m-entregados').value, 10) || 0,
      notas: document.getElementById('modal-m-notas').value
    };

    const idx = state.manzanas.findIndex(m => m && String(m.id) === String(manzanaId));
    if (idx !== -1) {
      state.manzanas[idx] = { ...state.manzanas[idx], ...updatedFields };
    }

    if (state.isUsingSupabase) {
      try {
        await updateManzana(manzanaId, updatedFields);
        showToast('Actualizado en Supabase con éxito', 'success');
        // LÓGICA DE CIERRE CÍCLICO AUTOMÁTICO S-13
        if (typeof window.SupabaseService?.verificarYCcerrarFraccion === 'function') {
          const fraccionActual = updatedFields.fraccion || (state.manzanas[idx]?.coordenadas?.properties?.fraccion);
          const nombreConductor = updatedFields.conductor_id || 'Conductor';

          if (fraccionActual) {
            window.SupabaseService.verificarYCcerrarFraccion(fraccionActual, nombreConductor).then((seCerro) => {
              if (seCerro) {
                alert("¡TERRITORIO COMPLETADO! 🎉\n\nTodas las manzanas de esta fracción fueron terminadas. Los datos han sido archivados de forma idéntica en el registro oficial S-13 y el territorio se ha reiniciado a blanco para la próxima campaña.");
                if (typeof fetchManzanas === 'function') fetchManzanas();
              }
            });
          }
        }

      } catch (err) {
        showToast(`Guardado local. Error Supabase: ${err.message}`, 'error');
      }
    } else {
      showToast('Manzana actualizada localmente', 'info');
    }

    closeModal('modal-manzana');
    renderAll(false);
  }

  // ========================================================
  // EVENTOS Y MODALES
  // ========================================================
  function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.activeTab = e.currentTarget.dataset.tab;
        state.currentPage = 1;
        renderSidebarList();
      });
    });

    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.activeFilter = e.currentTarget.dataset.filter;
        state.currentPage = 1;
        renderSidebarList();
      });
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        state.currentPage = 1;
        renderSidebarList();
      });
    }

    const btnToggleTiles = document.getElementById('btn-toggle-tiles');
    if (btnToggleTiles) {
      btnToggleTiles.addEventListener('click', () => {
        const nextStyle = state.tileStyle === 'streets' ? 'satellite' : 'streets';
        applyMapTiles(nextStyle);
        showToast(`Capa de mapa: ${nextStyle === 'satellite' ? 'Vista Satelital' : 'Calles Detalladas'}`, 'info');
      });
    }

    const btnCenter = document.getElementById('btn-center-rojas');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        if (state.manzanasFeatureGroup && state.manzanasFeatureGroup.getLayers().length > 0) {
          state.map.fitBounds(state.manzanasFeatureGroup.getBounds(), { padding: [40, 40] });
        } else {
          const config = getConfig();
          state.map.flyTo(config.mapCenter, config.defaultZoom, { duration: 1 });
        }
      });
    }

    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('collapsed');
        setTimeout(() => {
          if (state.map) state.map.invalidateSize();
        }, 300);
      });
    }

    document.getElementById('btn-supabase-status')?.addEventListener('click', openConfigModal);
    document.getElementById('btn-open-settings')?.addEventListener('click', openConfigModal);

    document.getElementById('btn-save-config')?.addEventListener('click', async () => {
      const rawUrl = document.getElementById('cfg-supabase-url').value;
      const rawKey = document.getElementById('cfg-supabase-key').value;

      saveConfig({
        rawSupabaseUrl: rawUrl,
        supabaseUrl: normalizeSupabaseUrl(rawUrl),
        supabaseKey: rawKey
      });

      closeModal('modal-config');
      showToast('Configuración guardada. Sincronizando con Supabase...', 'info');
      await checkAndSyncData();
    });

    document.getElementById('btn-test-config')?.addEventListener('click', async () => {
      const testStatusEl = document.getElementById('cfg-test-status');
      testStatusEl.textContent = '⏳ Probando conexión...';
      testStatusEl.style.color = '#38bdf8';

      const rawUrl = document.getElementById('cfg-supabase-url').value;
      const rawKey = document.getElementById('cfg-supabase-key').value;
      saveConfig({ rawSupabaseUrl: rawUrl, supabaseKey: rawKey });

      const test = await testConnection();
      testStatusEl.textContent = test.message;
      testStatusEl.style.color = test.success ? '#34d399' : '#f87171';
    });

    document.getElementById('btn-save-manzana')?.addEventListener('click', handleSaveManzana);

    // ========================================================
    // CONTROLADORES DE EVENTOS DEL REPORTE S-13
    // ========================================================
    const openS13Handler = () => {
      closeModal('modal-config');
      openS13Modal();
    };

    document.getElementById('btn-open-s13')?.addEventListener('click', openS13Handler);
    document.getElementById('btn-admin-open-s13')?.addEventListener('click', openS13Handler);

    // Selector de página y año en modal S-13
    document.getElementById('s13-input-year')?.addEventListener('input', () => {
      updateS13ModalPreview();
    });

    document.getElementById('s13-select-page')?.addEventListener('change', () => {
      updateS13ModalPreview();
    });

    // Botón de Descarga directa PDF S-13
    document.getElementById('btn-download-s13-pdf')?.addEventListener('click', async () => {
      const year = document.getElementById('s13-input-year')?.value.trim() || '2026';
      const pageIdx = parseInt(document.getElementById('s13-select-page')?.value, 10);

      const btn = document.getElementById('btn-download-s13-pdf');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span>⏳</span> <span>Generando PDF...</span>';
      btn.disabled = true;

      showToast('Generando reporte S-13 en PDF (A4)...', 'info');

      try {
        if (window.S13Report?.downloadS13PDF) {
          await window.S13Report.downloadS13PDF({
            serviceYear: year,
            pageIndex: isNaN(pageIdx) ? -1 : pageIdx
          });
          showToast('✅ Reporte S-13 descargado exitosamente', 'success');
        } else {
          showToast('Error: módulo S13Report no disponible', 'error');
        }
      } catch (err) {
        console.error('Error al generar PDF S-13:', err);
        showToast('Error al generar PDF: ' + err.message, 'error');
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });

    // Botón de impresión directa (A4)
    document.getElementById('btn-print-s13')?.addEventListener('click', async () => {
      const year = document.getElementById('s13-input-year')?.value.trim() || '2026';
      const pageIdx = parseInt(document.getElementById('s13-select-page')?.value, 10);

      // Asegurar que el contenedor de impresión tenga el contenido
      const target = document.getElementById('s13-print-render-target');
      if (target && window.S13Report) {
        showToast('Preparando vista de impresión...', 'info');
        await window.S13Report.downloadS13PDF({ serviceYear: year, pageIndex: isNaN(pageIdx) ? -1 : pageIdx });
      } else {
        window.print();
      }
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        closeModal(e.currentTarget.dataset.closeModal);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });
  }

  async function openS13Modal() {
    const modal = document.getElementById('modal-s13');
    if (!modal) return;
    modal.classList.add('open');
    await updateS13ModalPreview(true);
  }

  async function updateS13ModalPreview(rebuildPageOptions = false) {
    const year = document.getElementById('s13-input-year')?.value.trim() || '2026';
    const pageSelect = document.getElementById('s13-select-page');
    const selectedPage = pageSelect ? parseInt(pageSelect.value, 10) : 0;

    if (window.S13Report?.loadS13Preview) {
      const result = await window.S13Report.loadS13Preview(
        's13-preview-container',
        year,
        isNaN(selectedPage) ? 0 : selectedPage
      );

      // Si se solicita reconstruir las opciones de páginas
      if (rebuildPageOptions && result && result.totalPages > 0 && pageSelect) {
        const currentVal = pageSelect.value;
        pageSelect.innerHTML = '<option value="-1">Todas las hojas (Documento completo)</option>';
        for (let p = 0; p < result.totalPages; p++) {
          const from = p * 24 + 1;
          const to = (p + 1) * 24;
          const opt = document.createElement('option');
          opt.value = String(p);
          opt.textContent = `Página ${p + 1} (Territorios ${from} a ${to})`;
          if (String(p) === currentVal || (p === 0 && currentVal === '0')) {
            opt.selected = true;
          }
          pageSelect.appendChild(opt);
        }
      }
    }
  }

  function openConfigModal() {
    const config = getConfig();
    const urlEl = document.getElementById('cfg-supabase-url');
    const keyEl = document.getElementById('cfg-supabase-key');
    const statusEl = document.getElementById('cfg-test-status');

    if (urlEl) urlEl.value = config.rawSupabaseUrl || config.supabaseUrl;
    if (keyEl) keyEl.value = config.supabaseKey;
    if (statusEl) statusEl.textContent = '';
    document.getElementById('modal-config')?.classList.add('open');
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('open');
  }

  function updateStatusBadge(status, text) {
    state.connectionStatus = status;
    const pill = document.getElementById('btn-supabase-status');
    if (!pill) return;
    const indicator = pill.querySelector('.status-indicator');
    const label = pill.querySelector('.status-label');

    if (indicator) indicator.className = `status-indicator ${status}`;
    if (label) label.textContent = text;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // ========================================================
  // AUTOMATIZACIÓN CICLO S-13: CIERRE Y RESETEO DE FRACCIONES
  // ========================================================
  async function verificarYFijarCierreCiclo(fraccionId, conductorNombre) {
    console.log(`🔍 Verificando estado de la Fracción: ${fraccionId}`);
    const config = window.AppConfig?.DEFAULT_CONFIG || { supabaseUrl: 'https://supabase.co' };

    const bananasFraccion = window.AppState?.manzanas?.filter(m => (m.nombre_manzana || "").startsWith(`${fraccionId} -`)) || [];
    if (bananasFraccion.length === 0) return;

    const todasCompletadas = bananasFraccion.every(m => {
      const statusActual = (m.status || m.estado || "").toLowerCase();
      return statusActual === 'entregada' || statusActual === 'completada';
    });

    if (todasCompletadas) {
      console.log(`🎉 ¡Fracción ${fraccionId} al 100%! Archivando historial S-13...`);
      try {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 7);

        await fetch(`${config.supabaseUrl}/rest/v1/historial_s13`, {
          method: 'POST',
          headers: { 'apikey': config.supabaseKey, 'Authorization': `Bearer ${config.supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero_territorio: fraccionId,
            conductor: conductorNombre || 'Conductor Asignado',
            fecha_inicio: fechaInicio.toISOString().split('T')[0],
            fecha_completado: new Date().toISOString().split('T')[0]
          })
        });

        await fetch(`${config.supabaseUrl}/rest/v1/manzanas?nombre_manzana=ilike.${fraccionId}%20-%2A`, {
          method: 'PATCH',
          headers: { 'apikey': config.supabaseKey, 'Authorization': `Bearer ${config.supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Pending', conductor_actual: null })
        });

        showToast(`📊 ¡Territorio Fracción ${fraccionId} Completado! Datos archivados en S-13 y sector reiniciado.`, 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (error) {
        console.error('Error en cierre S-13:', error);
      }
    }
  }

  if (window.SupabaseService) {
    const originalUpdate = window.SupabaseService.updateManzana;
    window.SupabaseService.updateManzana = async function (id, datos) {
      if (originalUpdate) await originalUpdate(id, datos);
      if (datos && (datos.status === 'Entregada' || datos.status === 'completada')) {
        const manzana = window.AppState?.manzanas?.find(m => m.id === id);
        const partesNombre = (manzana?.nombre_manzana || "").split(' ');
        const fraccionId = partesNombre[0];
        if (fraccionId) verificarYFijarCierreCiclo(fraccionId, datos.conductor_actual);
      }
    };
  }

  // Interceptador para limpiar el guardado de datos eliminando los paquetes viejos
  if (document.getElementById('btn-save-manzana')) {
    document.getElementById('btn-save-manzana').addEventListener('click', async function () {
      const id = window.AppState?.selectedManzanaId;
      if (!id) return;

      const nuevoEstado = document.getElementById('modal-m-estado').value;
      const conductor = document.getElementById('modal-m-conductor').value;
      const notas = document.getElementById('modal-m-observaciones')?.value || '';

      // Mapeo seguro para Supabase usando tu estructura real de "status"
      let dbStatus = 'Pending';
      if (nuevoEstado === 'completada') dbStatus = 'Entregada';
      else if (nuevoEstado === 'en_reparto') dbStatus = 'en_reparto';
      else if (nuevoEstado === 'alerta') dbStatus = 'alerta';

      if (typeof window.TriggerUpdateManzanaStatus === 'function') {
        // Dispara la actualización real en la base de datos de Supabase
        await window.TriggerUpdateManzanaStatus(id, nuevoEstado, conductor);

        // Guardar las notas de predicación de forma segura si la columna existe
        if (window.SupabaseService?.updateManzana) {
          await window.SupabaseService.updateManzana(id, { status: dbStatus, conductor_actual: conductor, observaciones: notas });
        }

        // Cerrar el cuadro flotante manualmente emulando el clic de cancelar
        document.querySelector('[data-close-modal="modal-manzana"]')?.click();
      }
    });
  }
  // ========================================================
  // ACOPLAMIENTO DE CONDUCTORES DE PREDICACIÓN EN EL SELECTOR
  // ========================================================
  document.addEventListener('click', function (e) {
    const selectConductor = document.getElementById('modal-m-conductor');
    if (!selectConductor) return;

    // Si ya se cargaron las opciones reales de Supabase, evitamos duplicarlas

    const valorPrevio = selectConductor.value;
    selectConductor.innerHTML = '<option value="">-- Sin asignar --</option>';

    // Leer el listado de conductores sincronizados desde la base de datos
    const lista = state.conductores || [];
    if (lista.length > 0) {
      lista.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.codigo_conductor || c.nombre || '';
        opt.textContent = `${c.nombre} (${c.codigo_conductor || 'S/C'})`;
        if (String(c.codigo_conductor) === String(state.manzanas.find(m => m.id === state.selectedManzanaId)?.conductor_actual)) {
          opt.selected = true;
        }
        selectConductor.appendChild(opt);
      });
      if (valorPrevio) selectConductor.value = valorPrevio;
    } else {
      // Fallback de emergencia si la red local tarda en responder
      for (let i = 1; i <= 20; i++) {
        const opt = document.createElement('option');
        opt.value = `C-${String(i).padStart(2, '0')}`;
        opt.textContent = `Conductor ${i} (C-${String(i).padStart(2, '0')})`;
        selectConductor.appendChild(opt);
      }
    }
  });
  // ========================================================
  // RELLENO INMUTABLE DE CONDUCTORES REALES DE PREDICACIÓN
  // ========================================================
  document.addEventListener('click', function (e) {
    const selectConductor = document.getElementById('modal-m-conductor');
    if (!selectConductor) return;

    // Si ya tiene cargado alguno de los hermanos reales, no hacemos nada para no duplicar
    if (selectConductor.innerHTML.includes('Antonini') || selectConductor.innerHTML.includes('Aranda')) return;

    const valorPrevio = selectConductor.value;

    // Lista oficial y definitiva de los 18 hermanos de Rojas
    const hermanosReales = [
      { cod: 'C-01', nombre: 'Antonini, Gustavo' },
      { cod: 'C-02', nombre: 'Aranda, Luis Alejandro' },
      { cod: 'C-03', nombre: 'Blázquez, Daniel Omar' },
      { cod: 'C-04', nombre: 'Casanova, Roberto Daniel' },
      { cod: 'C-05', nombre: 'Castro, Esteban Román' },
      { cod: 'C-06', nombre: 'Enrique, Andrés' },
      { cod: 'C-07', nombre: 'Fontanet, Hernán Darío' },
      { cod: 'C-08', font: 'Fontanet, Juan Pablo' }, // Manejo de variaciones de claves
      { cod: 'C-09', nombre: 'García, Ramón Galo' },
      { cod: 'C-10', nombre: 'Ghirardi, Mauricio Juan' },
      { cod: 'C-11', nombre: 'Lomónico, Rodolfo V.' },
      { cod: 'C-12', nombre: 'Montiel Duré, Lucio' },
      { cod: 'C-13', nombre: 'Ruiz, Matias' },
      { cod: 'C-14', nombre: 'Suárez Cejas, Román Ezequiel' },
      { cod: 'C-15', nombre: 'Vezzoni, Lucas Ezequiel' },
      { cod: 'C-16', nombre: 'Vezzoni, Miguel Ángel' },
      { cod: 'C-17', nombre: 'Villaroel, Damián' },
      { cod: 'C-18', nombre: 'Vizcaino, Mario Antonio' }
    ];

    selectConductor.innerHTML = '<option value="">-- Sin asignar --</option>';

    hermanosReales.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.cod;
      opt.textContent = `${h.nombre || h.font} (${h.cod})`;
      selectConductor.appendChild(opt);
    });

    // Restaurar la asignación actual si la manzana ya tenía uno guardado
    if (valorPrevio) selectConductor.value = valorPrevio;
  });

})();
