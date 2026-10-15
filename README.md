# 🗺️ App de Control Territorial de Reparto • Rojas

Aplicación de control territorial y gestión de manzanas para conductores de reparto en **Rojas, Provincia de Buenos Aires**, integrada con base de datos en tiempo real mediante **Supabase** y cartografía interactiva con **Leaflet**.

---

## 🚀 Recomendación de Entorno (HTML/JS vs React)

Para este entorno local en Windows (donde actualmente no se encuentra instalado Node.js en el sistema), la arquitectura recomendada e implementada es **HTML5 Estructurado + JavaScript Modular (ES6 Modules) + CSS3 Moderno (Glassmorphism & Dark Mode)**:

- ✅ **Cero Dependencias Previas**: Funciona inmediatamente en cualquier navegador moderno sin requerir compilar o instalar runtimes adicionales.
- ✅ **Cliente Oficial de Supabase**: Se utiliza `@supabase/supabase-js` v2 mediante distribución ESM oficial optimizada.
- ✅ **Rendimiento Inmediato**: Carga ultra rápida en teléfonos móviles de repartidores y computadoras de despacho.
- ✅ **Fácil Transición a React**: La separación de componentes (`config.js`, `supabaseClient.js`, `manzanasData.js`, `app.js`) permite migrar cada módulo a componentes funcionales de React/Vite en minutos si se decide incorporar Node.js en el futuro.

---

## 📁 Estructura del Proyecto

```text
app territorios/
├── .env                  # Credenciales de Supabase solicitadas
├── .env.example          # Plantilla de referencia de variables de entorno
├── config.js             # Módulo de configuración, persistencia y sanitización de URLs
├── supabaseClient.js     # Cliente Supabase, verificación de conexión y métodos de base de datos
├── manzanasData.js       # Coordenadas reales de manzanas de Rojas y datos de prueba
├── schema.sql            # Script SQL listo para crear las tablas y políticas RLS en Supabase
├── index.html            # Interfaz visual principal, barra de métricas y modales
├── styles.css            # Sistema de diseño dark mode con glassmorphism y diseño responsivo
├── app.js                # Lógica del mapa interactivo Leaflet y sincronización de estados
├── package.json          # Metadatos del proyecto y comandos npm opcionales
└── README.md             # Esta documentación
```

---

## ⚙️ Configuración de Supabase

### 1. Archivo `.env`
El archivo `.env` se encuentra configurado en la raíz con las credenciales provistas:
```env
SUPABASE_URL=supabase.co
SUPABASE_KEY=sb_publishable_fk_-oGNjGBW9sPBxGBuiQg__k8TnZDN
```

> **Nota importante sobre la URL**: En proyectos de Supabase, la URL suele ser del formato `https://[id-de-tu-proyecto].supabase.co`. Podés actualizar la URL de tu proyecto real directamente en el archivo `.env` o desde el botón de ajustes **⚙️** dentro de la propia aplicación.

### 2. Creación de Tablas en Supabase
Abrí el archivo [schema.sql](file:///c:/Users/Lenovo24/Desktop/Ventas%20Especiales/OPERACIONES%20EQUIPO/OPERACIONES%20ROMAN%20SUAREZ/ROMAN/app%20territorios/schema.sql) y pegá su contenido en el **SQL Editor** de tu consola de Supabase:
- Crea la tabla `conductores` (repartidores, vehículos, teléfonos, colores identificadores).
- Crea la tabla `manzanas` (números de manzana, barrios, polígonos de coordenadas, estados de entrega).
- Configura las directivas de seguridad **RLS (Row Level Security)**.
- Inserta las manzanas centrales de la ciudad de Rojas (Plaza San Martín, Palacio Municipal, Av. 25 de Mayo, Alem, Iribarne, Av. Tormey).

---

## 🏃‍♂️ Cómo Iniciar la Aplicación

1. **Opción Directa (Recomendada)**: 
   - Abrí el archivo [index.html](file:///c:/Users/Lenovo24/Desktop/Ventas%20Especiales/OPERACIONES%20EQUIPO/OPERACIONES%20ROMAN%20SUAREZ/ROMAN/app%20territorios/index.html) en tu navegador web favorito (Google Chrome, Microsoft Edge, Firefox, Brave) o mediante la extensión *Live Server* de Visual Studio Code.
2. **Con Node.js (Opcional en el futuro)**:
   - Si instalás Node.js, podés ejecutar:
     ```bash
     npx serve .
     ```

---

## 🛵 Funcionalidades Incluidas

- **Mapa Centrado en Rojas**: Visualización interactiva de manzanas de reparto con colores según su estado (🟡 Pendiente, 🔵 En Reparto, 🟢 Entregada, 🔴 Alerta).
- **Control de Conductores**: Ubicación referencial y asignación de pedidos a motociclistas y utilitarios.
- **Métricas en Tiempo Real**: Conteo dinámico de manzanas totales, pendientes y finalizadas.
- **Buscador y Filtros**: Búsqueda por número de manzana, calle o barrio.
- **Inspector y Edición**: Modal para cambiar estados, reasignar conductores y registrar observaciones de entrega.
- **Indicador de Conexión**: Indicador visual inteligente que detecta si Supabase está conectado o si opera en modo demostración local.
