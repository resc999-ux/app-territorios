-- ========================================================
-- SCHEMA DE BASE DE DATOS PARA CONTROL TERRITORIAL EN ROJAS
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ========================================================

-- 1. Tabla de Conductores / Repartidores
CREATE TABLE IF NOT EXISTS public.conductores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    vehiculo TEXT DEFAULT 'Moto', -- 'Moto', 'Utilitario', 'Bicicleta'
    telefono TEXT,
    color TEXT DEFAULT '#3b82f6', -- Color identificador en el mapa
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Manzanas Territoriales
CREATE TABLE IF NOT EXISTS public.manzanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_manzana TEXT NOT NULL,
    barrio TEXT NOT NULL DEFAULT 'Centro',
    calles TEXT, -- Referencia de calles (ej: Av. 25 de Mayo, Alem, Iribarne, Pte. Perón)
    estado TEXT NOT NULL DEFAULT 'pendiente' 
        CHECK (estado IN ('pendiente', 'en_reparto', 'completada', 'alerta')),
    conductor_id UUID REFERENCES public.conductores(id) ON DELETE SET NULL,
    coordenadas JSONB NOT NULL, -- Polígono GeoJSON o array de [lat, lng]
    total_paquetes INT DEFAULT 0,
    paquetes_entregados INT DEFAULT 0,
    notas TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_manzanas_estado ON public.manzanas(estado);
CREATE INDEX IF NOT EXISTS idx_manzanas_conductor ON public.manzanas(conductor_id);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manzanas ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acceso público (Lectura y Actualización con anon key)
CREATE POLICY "Permitir lectura publica de conductores"
    ON public.conductores FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir modificacion publica de conductores"
    ON public.conductores FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir lectura publica de manzanas"
    ON public.manzanas FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir modificacion publica de manzanas"
    ON public.manzanas FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Habilitar Supabase Realtime para la tabla manzanas
ALTER PUBLICATION supabase_realtime ADD TABLE public.manzanas;

-- ========================================================
-- DATOS INICIALES DE PRUEBA (ROJAS, BUENOS AIRES)
-- ========================================================

-- Insertar conductores
INSERT INTO public.conductores (id, nombre, vehiculo, telefono, color, activo)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Carlos Mendoza', 'Moto 150cc', '2475-412345', '#3b82f6', true),
    ('22222222-2222-2222-2222-222222222222', 'Martín Silva', 'Utilitario Kangoo', '2475-498765', '#10b981', true),
    ('33333333-3333-3333-3333-333333333333', 'Lucas Fernández', 'Moto 110cc', '2475-433221', '#f59e0b', true)
ON CONFLICT (id) DO NOTHING;

-- Insertar Manzanas del Centro de Rojas (Alrededor de Plaza San Martín)
INSERT INTO public.manzanas (numero_manzana, barrio, calles, estado, conductor_id, total_paquetes, paquetes_entregados, notas, coordenadas)
VALUES
(
    'M-101 (Plaza Central)',
    'Centro',
    'Av. 25 de Mayo, Alem, Constitución, Iribarne',
    'en_reparto',
    '11111111-1111-1111-1111-111111111111',
    12,
    7,
    'Zona céntrica comercial. Alto flujo peatonal.',
    '[[ -34.1970, -60.7345 ], [ -34.1970, -60.7325 ], [ -34.1985, -60.7325 ], [ -34.1985, -60.7345 ]]'::jsonb
),
(
    'M-102 (Palacio Municipal)',
    'Centro',
    'Alem, Pte. Perón, Av. 25 de Mayo, Gral. Paz',
    'completada',
    '11111111-1111-1111-1111-111111111111',
    8,
    8,
    'Entregas matutinas completadas en edificios públicos.',
    '[[ -34.1952, -60.7345 ], [ -34.1952, -60.7325 ], [ -34.1967, -60.7325 ], [ -34.1967, -60.7345 ]]'::jsonb
),
(
    'M-103 (Comercio Este)',
    'Centro',
    'Iribarne, Av. 25 de Mayo, Dorrego, Moreno',
    'en_reparto',
    '22222222-2222-2222-2222-222222222222',
    15,
    9,
    'Locales comerciales sobre Iribarne.',
    '[[ -34.1970, -60.7322 ], [ -34.1970, -60.7302 ], [ -34.1985, -60.7302 ], [ -34.1985, -60.7322 ]]'::jsonb
),
(
    'M-104 (Residencial Norte)',
    'Progreso',
    'Gral. Paz, Tormey, María Unzué de Alvear, Zapiola',
    'pendiente',
    '33333333-3333-3333-3333-333333333333',
    6,
    0,
    'Planificado para entrega en turno tarde.',
    '[[ -34.1935, -60.7345 ], [ -34.1935, -60.7325 ], [ -34.1950, -60.7325 ], [ -34.1950, -60.7345 ]]'::jsonb
),
(
    'M-105 (Acceso Oeste)',
    'Las Margaritas',
    'Av. Tormey, Pueyrredón, Paso, Saavedra',
    'pendiente',
    NULL,
    9,
    0,
    'Pendiente de asignación de repartidor.',
    '[[ -34.1970, -60.7370 ], [ -34.1970, -60.7348 ], [ -34.1985, -60.7348 ], [ -34.1985, -60.7370 ]]'::jsonb
),
(
    'M-106 (Sur Estación)',
    'Estación',
    'Mitre, Lavalle, Larrea, Castelli',
    'alerta',
    '33333333-3333-3333-3333-333333333333',
    5,
    2,
    'Alerta: Domicilio cerrado con timbre roto en Mitre 342.',
    '[[ -34.1988, -60.7345 ], [ -34.1988, -60.7325 ], [ -34.2003, -60.7325 ], [ -34.2003, -60.7345 ]]'::jsonb
);

-- ========================================================
-- 7. TABLA DE HISTORIAL S-13 (Registro de Asignación de Territorio)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.historial_s13 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_terr TEXT NOT NULL,
    ultima_fecha_completo TEXT,
    -- Bloque 1
    asignado_1 TEXT,
    fecha_asigno_1 TEXT,
    fecha_completo_1 TEXT,
    -- Bloque 2
    asignado_2 TEXT,
    fecha_asigno_2 TEXT,
    fecha_completo_2 TEXT,
    -- Bloque 3
    asignado_3 TEXT,
    fecha_asigno_3 TEXT,
    fecha_completo_3 TEXT,
    -- Bloque 4
    asignado_4 TEXT,
    fecha_asigno_4 TEXT,
    fecha_completo_4 TEXT,
    ano_servicio TEXT DEFAULT '2026',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_s13_terr ON public.historial_s13(numero_terr);

ALTER TABLE public.historial_s13 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura publica de historial_s13"
    ON public.historial_s13 FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Permitir modificacion publica de historial_s13"
    ON public.historial_s13 FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Insertar registros semilla de prueba para formulario S-13 (Territorios 1 a 6)
INSERT INTO public.historial_s13 
    (numero_terr, ultima_fecha_completo, asignado_1, fecha_asigno_1, fecha_completo_1, asignado_2, fecha_asigno_2, fecha_completo_2, ano_servicio)
VALUES
    ('1', '14/11/25', 'Carlos Mendoza', '12/01/26', '28/02/26', 'Martín Silva', '15/03/26', '', '2026'),
    ('2', '05/12/25', 'Martín Silva', '08/01/26', '20/02/26', 'Lucas Fernández', '01/03/26', '14/04/26', '2026'),
    ('3', '22/10/25', 'Lucas Fernández', '10/01/26', '15/02/26', 'Carlos Mendoza', '20/02/26', '', '2026'),
    ('4', '30/09/25', 'Carlos Mendoza', '05/02/26', '18/03/26', '', '', '', '2026'),
    ('5', '18/11/25', 'Martín Silva', '02/02/26', '', '', '', '', '2026'),
    ('6', '12/08/25', 'Lucas Fernández', '15/01/26', '28/02/26', 'Martín Silva', '05/03/26', '10/04/26', '2026')
ON CONFLICT DO NOTHING;

