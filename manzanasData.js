/**
 * Datos semilla y fallback territorial para Rojas, Provincia de Buenos Aires
 * Coordenadas de referencia: Lat -34.1977, Lng -60.7337 (Plaza San Martín)
 */

const CONDUCTORES_DEFAULT = [
  { id: 'C-01', cod: 'C-01', codigo_conductor: 'C-01', nombre: 'Antonini, Gustavo', vehiculo: 'Moto', color: '#38bdf8', activo: true },
  { id: 'C-02', cod: 'C-02', codigo_conductor: 'C-02', nombre: 'Aranda, Luis Alejandro', vehiculo: 'Moto', color: '#34d399', activo: true },
  { id: 'C-03', cod: 'C-03', codigo_conductor: 'C-03', nombre: 'Blázquez, Daniel Omar', vehiculo: 'Utilitario', color: '#fbbf24', activo: true },
  { id: 'C-04', cod: 'C-04', codigo_conductor: 'C-04', nombre: 'Casanova, Roberto Daniel', vehiculo: 'Moto', color: '#f472b6', activo: true },
  { id: 'C-05', cod: 'C-05', codigo_conductor: 'C-05', nombre: 'Castro, Esteban Román', vehiculo: 'Moto', color: '#a78bfa', activo: true },
  { id: 'C-06', cod: 'C-06', codigo_conductor: 'C-06', nombre: 'Enrique, Andrés', vehiculo: 'Moto', color: '#fb923c', activo: true },
  { id: 'C-07', cod: 'C-07', codigo_conductor: 'C-07', nombre: 'Fontanet, Hernán Darío', vehiculo: 'Utilitario', color: '#2dd4bf', activo: true },
  { id: 'C-08', cod: 'C-08', codigo_conductor: 'C-08', nombre: 'Fontanet, Juan Pablo', vehiculo: 'Moto', color: '#f87171', activo: true },
  { id: 'C-09', cod: 'C-09', codigo_conductor: 'C-09', nombre: 'García, Ramón Galo', vehiculo: 'Moto', color: '#c084fc', activo: true },
  { id: 'C-10', cod: 'C-10', codigo_conductor: 'C-10', nombre: 'Ghirardi, Mauricio Juan', vehiculo: 'Utilitario', color: '#facc15', activo: true },
  { id: 'C-11', cod: 'C-11', codigo_conductor: 'C-11', nombre: 'Lomónico, Rodolfo V.', vehiculo: 'Moto', color: '#60a5fa', activo: true },
  { id: 'C-12', cod: 'C-12', codigo_conductor: 'C-12', nombre: 'Montiel Duré, Lucio', vehiculo: 'Moto', color: '#a3e635', activo: true },
  { id: 'C-13', cod: 'C-13', codigo_conductor: 'C-13', nombre: 'Ruiz, Matias', vehiculo: 'Moto', color: '#e879f9', activo: true },
  { id: 'C-14', cod: 'C-14', codigo_conductor: 'C-14', nombre: 'Suárez Cejas, Román Ezequiel', vehiculo: 'Utilitario', color: '#f97316', activo: true },
  { id: 'C-15', cod: 'C-15', codigo_conductor: 'C-15', nombre: 'Vezzoni, Lucas Ezequiel', vehiculo: 'Moto', color: '#06b6d4', activo: true },
  { id: 'C-16', cod: 'C-16', codigo_conductor: 'C-16', nombre: 'Vezzoni, Miguel Ángel', vehiculo: 'Moto', color: '#84cc16', activo: true },
  { id: 'C-17', cod: 'C-17', codigo_conductor: 'C-17', nombre: 'Villaroel, Damián', vehiculo: 'Moto', color: '#ec4899', activo: true },
  { id: 'C-18', cod: 'C-18', codigo_conductor: 'C-18', nombre: 'Vizcaino, Mario Antonio', vehiculo: 'Moto', color: '#6366f1', activo: true }
];

const MANZANAS_DEFAULT = [
  {
    id: 'm-101',
    numero_manzana: 'M-101 (Plaza San Martín)',
    barrio: 'Centro',
    calles: 'Av. 25 de Mayo, Alem, Constitución, Iribarne',
    estado: 'en_reparto',
    conductor_id: 'C-01',
    conductor: CONDUCTORES_DEFAULT[0],
    total_paquetes: 14,
    paquetes_entregados: 8,
    notas: 'Zona céntrica comercial. Alto flujo vehicular y peatonal.',
    coordenadas: [
      [-34.1970, -60.7348],
      [-34.1970, -60.7326],
      [-34.1986, -60.7326],
      [-34.1986, -60.7348]
    ]
  },
  {
    id: 'm-102',
    numero_manzana: 'M-102 (Palacio Municipal)',
    barrio: 'Centro',
    calles: 'Alem, Pte. Perón, Av. 25 de Mayo, Gral. Paz',
    estado: 'completada',
    conductor_id: 'C-01',
    conductor: CONDUCTORES_DEFAULT[0],
    total_paquetes: 8,
    paquetes_entregados: 8,
    notas: 'Edificios públicos e institucionales. Entregas de mañana.',
    coordenadas: [
      [-34.1952, -60.7348],
      [-34.1952, -60.7326],
      [-34.1968, -60.7326],
      [-34.1968, -60.7348]
    ]
  },
  {
    id: 'm-103',
    numero_manzana: 'M-103 (Comercio Este)',
    barrio: 'Centro',
    calles: 'Iribarne, Av. 25 de Mayo, Dorrego, Moreno',
    estado: 'en_reparto',
    conductor_id: 'C-02',
    conductor: CONDUCTORES_DEFAULT[1],
    total_paquetes: 18,
    paquetes_entregados: 11,
    notas: 'Sector de repuesteras y ferreterías sobre Iribarne.',
    coordenadas: [
      [-34.1970, -60.7323],
      [-34.1970, -60.7301],
      [-34.1986, -60.7301],
      [-34.1986, -60.7323]
    ]
  },
  {
    id: 'm-104',
    numero_manzana: 'M-104 (Residencial Norte)',
    barrio: 'Progreso',
    calles: 'Gral. Paz, Tormey, María Unzué de Alvear, Zapiola',
    estado: 'pendiente',
    conductor_id: 'C-03',
    conductor: CONDUCTORES_DEFAULT[2],
    total_paquetes: 7,
    paquetes_entregados: 0,
    notas: 'Calle de asfalto y mejorado. Reparto programado para las 16 hs.',
    coordenadas: [
      [-34.1934, -60.7348],
      [-34.1934, -60.7326],
      [-34.1950, -60.7326],
      [-34.1950, -60.7348]
    ]
  },
  {
    id: 'm-105',
    numero_manzana: 'M-105 (Acceso Oeste Tormey)',
    barrio: 'Las Margaritas',
    calles: 'Av. Tormey, Pueyrredón, Paso, Saavedra',
    estado: 'pendiente',
    conductor_id: null,
    conductor: null,
    total_paquetes: 10,
    paquetes_entregados: 0,
    notas: 'Zona residencial amplia. Requiere confirmación de turno.',
    coordenadas: [
      [-34.1970, -60.7373],
      [-34.1970, -60.7351],
      [-34.1986, -60.7351],
      [-34.1986, -60.7373]
    ]
  },
  {
    id: 'm-106',
    numero_manzana: 'M-106 (Sur Estación Ferrocarril)',
    barrio: 'Estación',
    calles: 'Mitre, Lavalle, Larrea, Castelli',
    estado: 'alerta',
    conductor_id: 'C-03',
    conductor: CONDUCTORES_DEFAULT[2],
    total_paquetes: 6,
    paquetes_entregados: 2,
    notas: '⚠️ Demora: cliente ausente en Mitre 340. Reintento a coordinar.',
    coordenadas: [
      [-34.1989, -60.7348],
      [-34.1989, -60.7326],
      [-34.2005, -60.7326],
      [-34.2005, -60.7348]
    ]
  },
  {
    id: 'm-107',
    numero_manzana: 'M-107 (Noreste Boulevard)',
    barrio: 'Progreso',
    calles: 'Dorrego, Alsina, Belgrano, San Martín',
    estado: 'pendiente',
    conductor_id: 'C-02',
    conductor: CONDUCTORES_DEFAULT[1],
    total_paquetes: 9,
    paquetes_entregados: 1,
    notas: 'Casas bajas particulares sobre Belgrano.',
    coordenadas: [
      [-34.1952, -60.7323],
      [-34.1952, -60.7301],
      [-34.1968, -60.7301],
      [-34.1968, -60.7323]
    ]
  },
  {
    id: 'm-108',
    numero_manzana: 'M-108 (Suroeste San Martín)',
    barrio: 'Las Margaritas',
    calles: 'Pueyrredón, Castelli, San Martín, Larrea',
    estado: 'completada',
    conductor_id: 'C-01',
    conductor: CONDUCTORES_DEFAULT[0],
    total_paquetes: 11,
    paquetes_entregados: 11,
    notas: 'Todos los paquetes recepcionados con firma digital.',
    coordenadas: [
      [-34.1989, -60.7373],
      [-34.1989, -60.7351],
      [-34.2005, -60.7351],
      [-34.2005, -60.7373]
    ]
  }
];

const ESTADO_COLORES = {
  pendiente: {
    fill: '#f59e0b',
    border: '#d97706',
    label: 'Pendiente',
    badgeClass: 'badge-warning'
  },
  en_reparto: {
    fill: '#3b82f6',
    border: '#2563eb',
    label: 'En Reparto',
    badgeClass: 'badge-info'
  },
  completada: {
    fill: '#10b981',
    border: '#059669',
    label: 'Entregada',
    badgeClass: 'badge-success'
  },
  alerta: {
    fill: '#ef4444',
    border: '#dc2626',
    label: 'Con Alerta',
    badgeClass: 'badge-danger'
  }
};

// Paleta oficial de 61 colores distintos para cada una de las 61 Fracciones de Rojas
const FRACCION_ORIGINAL_COLORES = {
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

// Exportar global para navegador
if (typeof window !== 'undefined') {
  window.ManzanasData = {
    CONDUCTORES_DEFAULT,
    MANZANAS_DEFAULT,
    ESTADO_COLORES,
    FRACCION_ORIGINAL_COLORES
  };
}
