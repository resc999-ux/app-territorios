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

  // ── Paleta oficial de colores originales de Google My Maps (Rojas Bs As - 61 Fracciones) ──
  const FRACCION_ORIGINAL_COLORES = (ManzanasData && ManzanasData.FRACCION_ORIGINAL_COLORES) || {
    1: '#4ade80',  2: '#818cf8',  3: '#fbbf24',  4: '#38bdf8',  5: '#f472b6',  6: '#a3e635',
    7: '#a78bfa',  8: '#fb923c',  9: '#2dd4bf', 10: '#f87171', 11: '#c084fc', 12: '#facc15',
    13: '#60a5fa', 14: '#34d399', 15: '#e879f9', 16: '#f97316', 17: '#06b6d4', 18: '#e11d48',
    19: '#84cc16', 20: '#6366f1', 21: '#eab308', 22: '#14b8a6', 23: '#ec4899', 24: '#0284c7',
    25: '#d97706', 26: '#10b981', 27: '#8b5cf6', 28: '#f59e0b', 29: '#0ea5e9', 30: '#ef4444',
    31: '#22c55e', 32: '#a855f7', 33: '#f9a8d4', 34: '#059669', 35: '#3b82f6', 36: '#ea580c',
    37: '#10b981', 38: '#7c3aed', 39: '#fcd34d', 40: '#2563eb', 41: '#f43f5e', 42: '#84cc16',
    43: '#9333ea', 44: '#fdba74', 45: '#0891b2', 46: '#be123c', 47: '#65a30d', 48: '#4f46e5',
    49: '#ca8a04', 50: '#0d9488', 51: '#db2777', 52: '#1d4ed8', 53: '#d97706', 54: '#16a34a',
    55: '#9333ea', 56: '#f59e0b', 57: '#0284c7', 58: '#dc2626', 59: '#6ee7b7', 60: '#c084fc',
    61: '#fed7aa'
  };

  // Identifica si un registro corresponde al perímetro macro de una Fracción (1 al 61)
  function esFraccionBoundary(manzana) {
    if (!manzana) return false;
    const name = String(manzana.nombre_manzana || manzana.numero_manzana || '').trim();
    return /^(?:Frac|F)/i.test(name) && /\d+/.test(name) && !/[-–]\s*[A-Za-z]/i.test(name);
  }

  // Extraer número de fracción desde nombre_manzana ("1 - A", "Fracción 1", "Fraccion 12", etc.)
  function getFraccionNumero(manzana) {
    if (!manzana) return null;
    const props = manzana.coordenadas?.properties || {};
    if (props.fraccion) return parseInt(props.fraccion, 10);
    if (props.num_territorio) return parseInt(props.num_territorio, 10);

    const num = String(manzana.nombre_manzana || manzana.numero_manzana || '').trim();

    // 1. Fracción boundary: "Fracción 1", "Fraccion 12", "Fracci├│n 12", "F 12", etc.
    if (/^(?:Frac|F)/i.test(num) && !/[-–]\s*[A-Za-z]/i.test(num)) {
      const matchNum = num.match(/\d+/);
      if (matchNum) return parseInt(matchNum[0], 10);
    }

    // 2. Individual manzana: "1 - A", "12 - B", "3-C", "1-A"
    const matchDash = num.match(/^(\d+)\s*[-–]/);
    if (matchDash) return parseInt(matchDash[1], 10);

    // 3. Fallbacks
    if (manzana.fraccion_id) return parseInt(manzana.fraccion_id, 10);
    if (manzana.num_territorio) return parseInt(manzana.num_territorio, 10);

    const matchLeadNum = num.match(/^(\d+)/);
    if (matchLeadNum) return parseInt(matchLeadNum[1], 10);

    return null;
  }

  function getColorPorFraccion(manzana) {
    const num = getFraccionNumero(manzana);
    if (num && FRACCION_ORIGINAL_COLORES[num]) {
      return FRACCION_ORIGINAL_COLORES[num];
    }
    if (num) {
      const triad = ['#8cc86e', '#2a9bf5', '#f5963c'];
      return triad[(num - 1) % 3];
    }
    return '#8cc86e'; // Verde original de origen
  }


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
      preferCanvas: false // Renderizado SVG nativo para interacción táctil y clic perfecta en manzanas interiores
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
      state.tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
    } else {
      state.tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
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
      const clean = ring.map(pt => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        let p0 = typeof pt[0] === 'number' ? pt[0] : parseFloat(pt[0]);
        let p1 = typeof pt[1] === 'number' ? pt[1] : parseFloat(pt[1]);
        if (isNaN(p0) || isNaN(p1)) return null;
        // Si p0 es latitud (~ -34) y p1 es longitud (~ -60), convertir a [lng, lat]
        if (Math.abs(p0) < 45 && Math.abs(p1) > 55) {
          return [p1, p0];
        }
        return [p0, p1];
      }).filter(Boolean);

      if (clean.length >= 3) {
        const first = clean[0];
        const last = clean[clean.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          clean.push([first[0], first[1]]);
        }
      }
      return clean;
    }

    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
      const fixedCoordinates = geo.coordinates.map(fixRing).filter(r => r.length >= 4);
      if (fixedCoordinates.length === 0) return null;
      return {
        ...geo,
        coordinates: fixedCoordinates
      };
    } else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) {
      const fixedPolygons = geo.coordinates.map(polygon => {
        if (!Array.isArray(polygon)) return [];
        return polygon.map(fixRing).filter(r => r.length >= 4);
      }).filter(p => p.length > 0);
      if (fixedPolygons.length === 0) return null;
      return {
        ...geo,
        coordinates: fixedPolygons
      };
    }
    return geo;
  }

  function normalizeManzanaRecord(raw, index) {
    if (!raw) return null;
    const id = raw.id || raw.gid || raw.ogc_fid || raw.cartodb_id || `manzana-${index}`;
    // Omitir registro de prueba que cubre todo Rojas con un polígono ficticio de 1km
    if (String(raw.nombre_manzana || '').includes('Prueba') || String(id) === '1') {
      return null;
    }

    // Columna nombre_manzana de Supabase contiene el nombre real ("1 - A", "Fracción 1", etc.)
    let nombreReal = String(raw.nombre_manzana || raw.numero_manzana || raw.manzana || raw.nro_manzana || raw.nombre || raw.name || `M-${index + 1}`).trim();
    // Limpiar posibles caracteres rotos de codificación ("Fracci├│n" -> "Fracción")
    nombreReal = nombreReal.replace(/^Fracci[^\s\d]+n/i, 'Fracción');
    const isBoundary = esFraccionBoundary({ nombre_manzana: nombreReal });
    const barrio = raw.barrio || raw.seccion || raw.circ || raw.zona || (isBoundary ? 'Límite Sector' : 'Rojas');
    const calles = raw.calles || raw.calle || raw.domicilio || raw.direccion || raw.descripcion || 'Sin referencia';
    const estado = (raw.estado && ESTADO_COLORES[raw.estado]) ? raw.estado : 'pendiente';

    // Parseo seguro de paquetes (soporta número o string "entregados/totales", ej "0/0")
    let total_paquetes = 0;
    let paquetes_entregados = 0;
    if (typeof raw.paquetes === 'string' && raw.paquetes.includes('/')) {
      const parts = raw.paquetes.split('/');
      paquetes_entregados = Number(parts[0]) || 0;
      total_paquetes = Number(parts[1]) || 0;
    } else {
      total_paquetes = Number(raw.total_paquetes ?? raw.paquetes_totales ?? raw.paquetes ?? 0) || 0;
      paquetes_entregados = Number(raw.paquetes_entregados ?? raw.entregados_paquetes ?? 0) || 0;
    }

    const conductor_id = raw.conductor_id || raw.repartidor_id || null;
    const notas = raw.notas || '';

    return {
      ...raw,
      id: String(id),
      nombre_manzana: nombreReal,
      numero_manzana: nombreReal,
      es_fraccion: isBoundary,
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

      // Ordenar: primero los perímetros de Fracción (al fondo), luego las manzanas individuales (arriba)
      const sortedManzanas = [...state.manzanas].sort((a, b) => {
        const aIsFrac = a?.es_fraccion || esFraccionBoundary(a);
        const bIsFrac = b?.es_fraccion || esFraccionBoundary(b);
        if (aIsFrac && !bIsFrac) return -1;
        if (!aIsFrac && bIsFrac) return 1;
        return 0;
      });

      // 1. Dibujar manzanas con colores de Google My Maps y etiquetas correspondientes
      sortedManzanas.forEach(manzana => {
        if (!manzana) return;
        const geoData = extractGeoJSON(manzana);
        if (!geoData) return;

        const isFraccion = manzana.es_fraccion || esFraccionBoundary(manzana);
        const isSelected = state.selectedManzanaId === manzana.id;
        const fraccionNum = getFraccionNumero(manzana);
        const fraccionColor = getColorPorFraccion(manzana);
        const estadoInfo = ESTADO_COLORES[manzana.estado] || ESTADO_COLORES.pendiente;

        let fillColor, fillOpacity, borderColor, borderWeight, dashArray;

        if (isFraccion) {
          // Las 61 Fracciones o Territorios principales: color de fondo visible del sector
          fillColor = fraccionColor;
          fillOpacity = isSelected ? 0.65 : 0.38;
          borderColor = isSelected ? '#38bdf8' : '#0f172a';
          borderWeight = isSelected ? 3.5 : 2;
          dashArray = null;
        } else {
          // Manzanas individuales interiores
          dashArray = null;
          if (manzana.estado === 'completada') {
            fillColor = estadoInfo.fill; // Verde esmeralda #10b981
            fillOpacity = isSelected ? 0.90 : 0.75;
            borderColor = isSelected ? '#38bdf8' : estadoInfo.border;
            borderWeight = isSelected ? 3 : 1.5;
          } else if (manzana.estado === 'alerta') {
            fillColor = estadoInfo.fill; // Rojo alerta #ef4444
            fillOpacity = isSelected ? 0.90 : 0.75;
            borderColor = isSelected ? '#38bdf8' : estadoInfo.border;
            borderWeight = isSelected ? 3 : 2;
          } else if (manzana.estado === 'en_reparto') {
            fillColor = estadoInfo.fill; // Azul en reparto #3b82f6
            fillOpacity = isSelected ? 0.90 : 0.75;
            borderColor = isSelected ? '#38bdf8' : estadoInfo.border;
            borderWeight = isSelected ? 3 : 1.5;
          } else {
            // pendiente: tono suave de la fracción con borde blanco nítido para delimitar calles
            fillColor = fraccionColor;
            fillOpacity = isSelected ? 0.65 : 0.22;
            borderColor = isSelected ? '#38bdf8' : 'rgba(255,255,255,0.75)';
            borderWeight = isSelected ? 2.5 : 1.2;
          }
        }

        try {
          const geoLayer = L.geoJSON(geoData, {
            style: {
              color: borderColor,
              fillColor: fillColor,
              fillOpacity: fillOpacity,
              weight: borderWeight,
              dashArray: dashArray
            },
            // IMPORTANTE: la fracción es fondo (no interactiva) para que el clic pase
            // directamente a las manzanas individuales que contiene
            interactive: !isFraccion
          });

          // Solo colocar el número interior en el centro de cada Fracción (del 1 al 61)
          // No se colocan carteles a las manzanas individuales para evitar saturar la imagen
          if (isFraccion && fraccionNum) {
            try {
              const bounds = geoLayer.getBounds();
              if (bounds && bounds.isValid()) {
                const center = bounds.getCenter();
                const labelHtml = `<div class="fraccion-centro-numero">${fraccionNum}</div>`;

                const labelMarker = L.marker(center, {
                  icon: L.divIcon({
                    html: labelHtml,
                    className: 'fraccion-centroid-label',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                  }),
                  interactive: false,
                  zIndexOffset: 300
                });
                labelMarker.addTo(state.manzanasFeatureGroup);
              }
            } catch (labelErr) {
              // Silencioso
            }
          }

          const rawName = manzana.nombre_manzana || manzana.numero_manzana || (isFraccion ? `Fracción ${fraccionNum || ''}` : `Manzana ${manzana.id}`);

          if (!isFraccion) {
            // Tooltip descriptivo en la manzana individual al pasar el cursor o pulsar
            geoLayer.bindTooltip(`
              <div style="font-size:12px; line-height:1.4;">
                <strong style="color:#38bdf8; font-size:13px;">${rawName}</strong><br/>
                <span style="color:#cbd5e1;">Fracción ${fraccionNum || 'Rojas'}</span><br/>
                <span style="color:#94a3b8;">Estado:</span> <strong style="color:${fillColor};">${estadoInfo.label}</strong><br/>
                <span>📦 Paquetes: ${manzana.paquetes_entregados}/${manzana.total_paquetes}</span>
              </div>
            `, { className: 'manzana-tooltip', sticky: true, opacity: 0.95 });

            // Permitir seleccionar y marcar la manzana haciendo clic directo en el mapa
            geoLayer.on('click', (e) => {
              if (e && e.originalEvent && L.DomEvent) {
                L.DomEvent.stopPropagation(e);
              }
              selectManzana(manzana.id);
            });
          }

          state.manzanasFeatureGroup.addLayer(geoLayer);
          state.geoJsonLayersMap.set(manzana.id, geoLayer);
          validLayersCount++;
        } catch (err) {
          console.warn('Aviso: no se pudo dibujar poligono de manzana:', manzana.id, err);
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
              <div class="popup-calles">${conductor.vehiculo} • ${conductor.telefono || 'Sin telefono'}</div>
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
      const isFraccion = manzana.es_fraccion || esFraccionBoundary(manzana);
      const fraccionColor = getColorPorFraccion(manzana);

      const card = document.createElement('div');
      card.className = `manzana-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="manzana-card-header">
          <span class="manzana-num" style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${fraccionColor};flex-shrink:0;"></span>
            ${manzana.numero_manzana}
          </span>
          <span class="badge ${isFraccion ? 'badge-info' : estadoInfo.badgeClass}">
            ${isFraccion ? 'Límite Sector' : estadoInfo.label}
          </span>
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

    const listaConductores = (state.conductores && state.conductores.length >= 18) ? state.conductores : CONDUCTORES_DEFAULT;
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

    // Titulo de la manzana
    const titleEl = document.getElementById('modal-m-title');
    if (titleEl) titleEl.textContent = manzana.numero_manzana || manzana.nombre_manzana || 'Manzana';

    // Estado
    const estadoEl = document.getElementById('modal-m-estado');
    if (estadoEl) estadoEl.value = manzana.status || manzana.estado || 'pendiente';

    // Observaciones
    const obsEl = document.getElementById('modal-m-observaciones');
    if (obsEl) obsEl.value = manzana.observaciones || manzana.notas || '';

    // ── Selector de conductores (MEJORADO - siempre funciona) ─────────────
    const selectConductor = document.getElementById('modal-m-conductor');
    if (selectConductor) {
      selectConductor.innerHTML = '<option value="">-- Sin asignar --</option>';
      selectConductor.disabled = false;  // Asegurar que no este bloqueado

      // Lista oficial de conductores reales de Rojas
      const CONDUCTORES_FALLBACK = [
        { cod: 'C-01', nombre: 'Antonini, Gustavo' },
        { cod: 'C-02', nombre: 'Aranda, Luis Alejandro' },
        { cod: 'C-03', nombre: 'Blázquez, Daniel Omar' },
        { cod: 'C-04', nombre: 'Casanova, Roberto Daniel' },
        { cod: 'C-05', nombre: 'Castro, Esteban Román' },
        { cod: 'C-06', nombre: 'Enrique, Andrés' },
        { cod: 'C-07', nombre: 'Fontanet, Hernán Darío' },
        { cod: 'C-08', nombre: 'Fontanet, Juan Pablo' },
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

      // Siempre garantizar la lista de los 18 conductores oficiales de Rojas
      const listaConductores = (CONDUCTORES_DEFAULT && CONDUCTORES_DEFAULT.length >= 18)
        ? CONDUCTORES_DEFAULT
        : CONDUCTORES_FALLBACK.map(h => ({
            id: h.cod,
            nombre: h.nombre,
            codigo_conductor: h.cod
          }));

      listaConductores.forEach(c => {
        if (!c) return;
        const opt = document.createElement('option');
        const cod = c.codigo_conductor || c.cod || c.id || '';
        opt.value = cod;
        opt.textContent = c.nombre + (cod ? ` (${cod})` : '');
        // Seleccionar el actual si coincide
        const conductorActual = manzana.conductor_actual || manzana.conductor_id || '';
        if (
          String(cod) === String(conductorActual) ||
          String(c.nombre) === String(conductorActual)
        ) {
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

    const estadoNuevo = document.getElementById('modal-m-estado').value;
    const conductorVal = document.getElementById('modal-m-conductor').value || null;
    const notasVal = document.getElementById('modal-m-observaciones')?.value || '';

    // Mapeo de estado UI -> campo DB
    let dbStatus = 'Pending';
    if (estadoNuevo === 'completada') dbStatus = 'Entregada';
    else if (estadoNuevo === 'en_reparto') dbStatus = 'en_reparto';
    else if (estadoNuevo === 'alerta') dbStatus = 'alerta';

    // Campos exactos de la tabla 'manzanas' en Supabase (evita error de columna inexistente)
    const dbPayload = {
      estado: estadoNuevo,
      status: dbStatus,
      conductor_id: conductorVal,
      notas: notasVal,
      updated_at: new Date().toISOString()
    };

    const updatedFields = {
      ...dbPayload,
      conductor_actual: conductorVal,
      observaciones: notasVal
    };

    const idx = state.manzanas.findIndex(m => m && String(m.id) === String(manzanaId));
    if (idx !== -1) {
      state.manzanas[idx] = { ...state.manzanas[idx], ...updatedFields };
    }

    if (state.isUsingSupabase) {
      try {
        await updateManzana(manzanaId, dbPayload);
        showToast('✅ Manzana guardada en Supabase', 'success');

        // ── LOGICA DE CASCADA EN FRACCION ────────────────────────────────
        // Obtener la fraccion a la que pertenece esta manzana
        const manzanaActualizada = state.manzanas[idx];
        const fraccionId = getFraccionNumero(manzanaActualizada);

        if (fraccionId) {
          // Determinar nombre del conductor para el historial
          const conductorNombre = (() => {
            const c = state.conductores.find(x =>
              x && (String(x.codigo_conductor) === String(conductorVal) ||
                    String(x.nombre) === String(conductorVal) ||
                    String(x.id) === String(conductorVal))
            );
            return c ? c.nombre : (conductorVal || 'Sin asignar');
          })();

          // Manzanas de la misma fraccion
          const manzanasFraccion = state.manzanas.filter(m => m && getFraccionNumero(m) === fraccionId);

          // FECHA DE INICIO: si pasa a 'en_reparto' y es la PRIMERA de la fraccion
          if (estadoNuevo === 'en_reparto') {
            const yaHabiaEnReparto = manzanasFraccion.some(m =>
              m.id !== manzanaId && (m.estado === 'en_reparto' || m.estado === 'completada')
            );
            if (!yaHabiaEnReparto) {
              // Es la primera manzana abierta de la fraccion -> registrar inicio
              await registrarInicioFraccion(fraccionId, conductorNombre);
            }
          }

          // FECHA DE FIN: si pasa a 'completada', verificar si TODAS completadas
          if (estadoNuevo === 'completada') {
            const todasCompletas = manzanasFraccion.every(m =>
              m.id === manzanaId ? true : (m.estado === 'completada')
            );
            if (todasCompletas && manzanasFraccion.length > 0) {
              await cerrarFraccion(fraccionId, conductorNombre);
            }
          }
        }
        // ─────────────────────────────────────────────────────────────────

      } catch (err) {
        showToast(`Guardado local. Error Supabase: ${err.message}`, 'error');
      }
    } else {
      showToast('Manzana actualizada localmente', 'info');
    }

    closeModal('modal-manzana');
    renderAll(false);
  }

  // ── Registrar INICIO de fraccion en historial_s13 ─────────────────────────
  async function registrarInicioFraccion(fraccionId, conductorNombre) {
    try {
      const client = window.SupabaseService?.getSupabase?.();
      if (!client) return;

      const ahora = new Date();
      const fechaStr = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const ano = ahora.getFullYear();

      // Buscar si ya existe una fila para este territorio en el ano actual
      const { data: existente } = await client
        .from('historial_s13')
        .select('*')
        .eq('numero_terr', String(fraccionId))
        .eq('ano_servicio', String(ano))
        .maybeSingle();

      if (!existente) {
        // Crear nueva fila con el conductor y la fecha de inicio
        await client.from('historial_s13').insert({
          numero_terr: String(fraccionId),
          ano_servicio: String(ano),
          ultima_fecha_completo: null,
          asignado_1: conductorNombre,
          fecha_asigno_1: fechaStr,
          fecha_completo_1: ''
        });
        console.log(`[S-13] Inicio de Fraccion ${fraccionId} registrado para ${conductorNombre}`);
        showToast(`📅 Inicio del Territorio ${fraccionId} registrado automaticamente`, 'info');
      }
    } catch (err) {
      console.warn('[S-13] Error al registrar inicio de fraccion:', err);
    }
  }

  // ── Cerrar FRACCION completa: guardar fecha fin y resetear manzanas ─────────
  async function cerrarFraccion(fraccionId, conductorNombre) {
    try {
      const client = window.SupabaseService?.getSupabase?.();
      if (!client) return;

      const ahora = new Date();
      const fechaStr = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const ano = ahora.getFullYear();

      // Buscar la fila del historial para actualizar la fecha de fin
      const { data: existente } = await client
        .from('historial_s13')
        .select('*')
        .eq('numero_terr', String(fraccionId))
        .eq('ano_servicio', String(ano))
        .maybeSingle();

      // Determinar en que bloque guardar la fecha de fin
      if (existente) {
        const updatePayload = { ultima_fecha_completo: fechaStr };
        // Completar el bloque que corresponda segun cual tiene fecha_asigno pero no fecha_completo
        if (existente.asignado_1 && !existente.fecha_completo_1) {
          updatePayload.fecha_completo_1 = fechaStr;
        } else if (existente.asignado_2 && !existente.fecha_completo_2) {
          updatePayload.fecha_completo_2 = fechaStr;
        } else if (existente.asignado_3 && !existente.fecha_completo_3) {
          updatePayload.fecha_completo_3 = fechaStr;
        } else if (existente.asignado_4 && !existente.fecha_completo_4) {
          updatePayload.fecha_completo_4 = fechaStr;
        }
        await client.from('historial_s13').update(updatePayload).eq('id', existente.id);
      } else {
        // Crear registro completo si no existia
        await client.from('historial_s13').insert({
          numero_terr: String(fraccionId),
          ano_servicio: String(ano),
          ultima_fecha_completo: fechaStr,
          asignado_1: conductorNombre,
          fecha_asigno_1: fechaStr,
          fecha_completo_1: fechaStr
        });
      }

      console.log(`[S-13] Fraccion ${fraccionId} COMPLETADA. Fecha fin: ${fechaStr}`);

      // Mostrar alerta de exito
      showToast(`🎉 Territorio ${fraccionId} COMPLETADO. Datos archivados en S-13.`, 'success');
      setTimeout(() => {
        if (confirm(`¡TERRITORIO ${fraccionId} COMPLETADO!\n\nTodas las manzanas de esta fraccion fueron terminadas.\nLos datos han sido archivados en el Registro S-13.\n\n¿Deseas recargar el mapa para ver el territorio reiniciado?`)) {
          location.reload();
        }
      }, 800);

    } catch (err) {
      console.warn('[S-13] Error al cerrar fraccion:', err);
    }
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


})();
