/**
 * Módulo de Generación y Exportación del Formulario Oficial S-13
 * "REGISTRO DE ASIGNACIÓN DE TERRITORIO" (S-13-S 1/22)
 * Cumple estrictamente con el formato físico oficial en tamaño Hoja A4 vertical.
 */

(function () {
  const ROWS_PER_PAGE = 24; // Cantidad estándar exacta de territorios por hoja S-13
  const TOTAL_TERRITORIES = 61; // Total de territorios/fracciones de Rojas

  /**
   * Procesa las filas de historial_s13 y agrupa por territorio
   */
  function processHistorialData(rawData, fallbackManzanas, fallbackConductores) {
    const territoryMap = new Map();

    // 1. Si vienen datos desde Supabase (historial_s13)
    if (Array.isArray(rawData) && rawData.length > 0) {
      rawData.forEach((row, idx) => {
        const numTerr = String(row.numero_terr || row.numero_territorio || row.territorio || row.id || (idx + 1)).trim();
        
        // Formato ancho (columnas asignado_1, asignado_2...)
        if (row.asignado_1 !== undefined || row.asignado_2 !== undefined) {
          territoryMap.set(numTerr, {
            numero_terr: numTerr,
            ultima_fecha_completo: row.ultima_fecha_completo || row.ultima_fecha || '',
            blocks: [
              { asignado: row.asignado_1 || '', fecha_asigno: row.fecha_asigno_1 || '', fecha_completo: row.fecha_completo_1 || '' },
              { asignado: row.asignado_2 || '', fecha_asigno: row.fecha_asigno_2 || '', fecha_completo: row.fecha_completo_2 || '' },
              { asignado: row.asignado_3 || '', fecha_asigno: row.fecha_asigno_3 || '', fecha_completo: row.fecha_completo_3 || '' },
              { asignado: row.asignado_4 || '', fecha_asigno: row.fecha_asigno_4 || '', fecha_completo: row.fecha_completo_4 || '' }
            ]
          });
        } 
        // Formato largo (una fila por asignación)
        else {
          if (!territoryMap.has(numTerr)) {
            territoryMap.set(numTerr, {
              numero_terr: numTerr,
              ultima_fecha_completo: row.ultima_fecha_completo || row.ultima_fecha || '',
              blocks: []
            });
          }
          const item = territoryMap.get(numTerr);
          if (item.blocks.length < 4) {
            item.blocks.push({
              asignado: row.asignado_a || row.asignado || row.conductor || '',
              fecha_asigno: row.fecha_asigno || row.fecha_asignacion || '',
              fecha_completo: row.fecha_completo || row.fecha_completado || ''
            });
          }
        }
      });
    }

    // 2. Garantizar que todos los territorios del 1 al TOTAL_TERRITORIES (61) existan en el registro
    for (let i = 1; i <= TOTAL_TERRITORIES; i++) {
      const key = String(i);
      if (!territoryMap.has(key)) {
        territoryMap.set(key, {
          numero_terr: key,
          ultima_fecha_completo: '',
          blocks: [
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' }
          ]
        });
      }
    }

    // Asegurar que cada territorio tenga exactamente 4 bloques
    const list = Array.from(territoryMap.values());
    list.forEach(t => {
      while (t.blocks.length < 4) {
        t.blocks.push({ asignado: '', fecha_asigno: '', fecha_completo: '' });
      }
    });

    // Ordenar naturalmente por número de territorio (numérico)
    list.sort((a, b) => {
      const na = parseInt(a.numero_terr, 10);
      const nb = parseInt(b.numero_terr, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.numero_terr.localeCompare(b.numero_terr);
    });

    // Dividir en páginas de 24 territorios exactos (formato oficial de la hoja S-13)
    const pages = [];
    for (let i = 0; i < list.length; i += ROWS_PER_PAGE) {
      const pageItems = list.slice(i, i + ROWS_PER_PAGE);
      
      // Si la última página tiene menos de 24 filas, rellenar con filas vacías para mantener la altura A4 exacta
      while (pageItems.length < ROWS_PER_PAGE) {
        pageItems.push({
          numero_terr: '',
          ultima_fecha_completo: '',
          blocks: [
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' },
            { asignado: '', fecha_asigno: '', fecha_completo: '' }
          ]
        });
      }
      pages.push(pageItems);
    }

    return pages;
  }

  /**
   * Genera el HTML de una o más páginas S-13 con el diseño idéntico al PDF
   */
  function buildS13PagesHTML(pages, serviceYear = '2026') {
    let html = '';

    pages.forEach((pageItems, pageIdx) => {
      let rowsHtml = '';

      pageItems.forEach(t => {
        const b = t.blocks;

        // Fila 1 del territorio: Número (rowspan 2), Última fecha (rowspan 2) y 4 nombres (colspan 2)
        rowsHtml += `
          <tr class="s13-row-name">
            <td rowspan="2" class="s13-col-num">${t.numero_terr || '&nbsp;'}</td>
            <td rowspan="2" class="s13-col-last-date s13-border-right-thick">${t.ultima_fecha_completo || '&nbsp;'}</td>
            <td colspan="2" class="s13-col-name">${b[0]?.asignado || '&nbsp;'}</td>
            <td colspan="2" class="s13-col-name">${b[1]?.asignado || '&nbsp;'}</td>
            <td colspan="2" class="s13-col-name">${b[2]?.asignado || '&nbsp;'}</td>
            <td colspan="2" class="s13-col-name">${b[3]?.asignado || '&nbsp;'}</td>
          </tr>
        `;

        // Fila 2 del territorio: 4 pares de fechas (asignó / completó)
        rowsHtml += `
          <tr class="s13-row-dates s13-border-bottom-item">
            <td class="s13-col-date">${b[0]?.fecha_asigno || '&nbsp;'}</td>
            <td class="s13-col-date">${b[0]?.fecha_completo || '&nbsp;'}</td>
            <td class="s13-col-date">${b[1]?.fecha_asigno || '&nbsp;'}</td>
            <td class="s13-col-date">${b[1]?.fecha_completo || '&nbsp;'}</td>
            <td class="s13-col-date">${b[2]?.fecha_asigno || '&nbsp;'}</td>
            <td class="s13-col-date">${b[2]?.fecha_completo || '&nbsp;'}</td>
            <td class="s13-col-date">${b[3]?.fecha_asigno || '&nbsp;'}</td>
            <td class="s13-col-date">${b[3]?.fecha_completo || '&nbsp;'}</td>
          </tr>
        `;
      });

      html += `
        <div class="s13-sheet" data-page="${pageIdx + 1}">
          <div class="s13-header">
            <h1 class="s13-title">REGISTRO DE ASIGNACIÓN DE TERRITORIO</h1>
            <div class="s13-service-year-container">
              <span class="s13-service-year-label">Año de servicio:</span>
              <span class="s13-service-year-line">${serviceYear ? `&nbsp;${serviceYear}&nbsp;` : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>
            </div>
          </div>

          <table class="s13-table">
            <thead>
              <tr class="s13-th-top">
                <th rowspan="2" class="s13-col-num s13-th-cell">Núm.<br>de terr.</th>
                <th rowspan="2" class="s13-col-last-date s13-th-cell s13-border-right-thick">Última fecha<br>en que se<br>completó*</th>
                <th colspan="2" class="s13-col-block-head s13-th-cell">Asignado a</th>
                <th colspan="2" class="s13-col-block-head s13-th-cell">Asignado a</th>
                <th colspan="2" class="s13-col-block-head s13-th-cell">Asignado a</th>
                <th colspan="2" class="s13-col-block-head s13-th-cell">Asignado a</th>
              </tr>
              <tr class="s13-th-bottom">
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se asignó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se completó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se asignó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se completó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se asignó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se completó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se asignó</th>
                <th class="s13-col-sub s13-th-cell">Fecha en que<br>se completó</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="s13-footer">
            <div class="s13-footer-note">*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.</div>
            <div class="s13-footer-code">S-13-S 1/22</div>
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * Genera y descarga el documento PDF mediante html2pdf.js
   */
  async function downloadS13PDF(options = {}) {
    const serviceYear = options.serviceYear || '2026';
    const pageIndex = options.pageIndex !== undefined ? options.pageIndex : -1; // -1 = todas las páginas

    // 1. Verificar disponibilidad de html2pdf
    if (typeof html2pdf === 'undefined') {
      alert('La librería html2pdf.js aún se está cargando. Por favor, reintenta en unos instantes.');
      return;
    }

    const container = document.getElementById('s13-print-render-target');
    if (!container) {
      console.error('Contenedor de impresión S-13 no encontrado');
      return;
    }

    // 2. Traer datos reales desde Supabase o fallback
    let rawHistorial = [];
    try {
      if (window.SupabaseService?.fetchHistorialS13) {
        rawHistorial = await window.SupabaseService.fetchHistorialS13();
      }
    } catch (e) {
      console.warn('No se pudo consultar historial_s13:', e);
    }

    const fallbackManzanas = window.AppState?.manzanas || [];
    const fallbackConductores = window.AppState?.conductores || [];

    const pages = processHistorialData(rawHistorial, fallbackManzanas, fallbackConductores);
    const pagesToExport = (pageIndex >= 0 && pageIndex < pages.length) ? [pages[pageIndex]] : pages;

    // 3. Inyectar HTML y preparar contenedor en posición medible para html2canvas
    container.style.display = 'block';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-9999';
    container.style.width = '210mm';
    container.style.height = 'auto';
    container.style.background = '#ffffff';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';

    container.innerHTML = buildS13PagesHTML(pagesToExport, serviceYear);

    // Esperar un ciclo para que el navegador dimensione el DOM y tablas antes del renderizado canvas
    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. Configurar html2pdf para formato A4 vertical exacto
    const pageSuffix = (pageIndex >= 0) ? `_Pagina_${pageIndex + 1}` : '_Completo';
    const opt = {
      margin: 0,
      filename: `S-13_Registro_Asignacion_Territorio_${serviceYear}${pageSuffix}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2, // Alta definición para texto nítido
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['css', 'legacy'], after: '.s13-sheet' }
    };

    try {
      await html2pdf().set(opt).from(container).save();
      console.log('✅ PDF de Formulario S-13 generado y descargado exitosamente');
    } catch (err) {
      console.error('Error al generar PDF S-13:', err);
      alert('Ocurrió un error al generar el PDF: ' + err.message);
    } finally {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  /**
   * Prepara la vista previa interactiva en el modal de Administrador
   */
  async function loadS13Preview(previewContainerId, serviceYear = '2026', pageIndex = 0) {
    const previewEl = document.getElementById(previewContainerId);
    if (!previewEl) return;

    previewEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Cargando datos históricos S-13 desde Supabase...</div>';

    let rawHistorial = [];
    try {
      if (window.SupabaseService?.fetchHistorialS13) {
        rawHistorial = await window.SupabaseService.fetchHistorialS13();
      }
    } catch (e) {
      console.warn('Error al cargar vista previa S-13:', e);
    }

    const fallbackManzanas = window.AppState?.manzanas || [];
    const fallbackConductores = window.AppState?.conductores || [];

    const pages = processHistorialData(rawHistorial, fallbackManzanas, fallbackConductores);
    const selectedPages = (pageIndex >= 0 && pageIndex < pages.length) ? [pages[pageIndex]] : pages;

    previewEl.innerHTML = buildS13PagesHTML(selectedPages, serviceYear);

    return { totalPages: pages.length, totalTerritories: pages.length * ROWS_PER_PAGE };
  }

  // Exportar API global
  window.S13Report = {
    downloadS13PDF,
    loadS13Preview,
    processHistorialData,
    buildS13PagesHTML
  };
})();
