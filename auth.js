/**
 * Sistema de autenticación por contraseña para Control Territorial (Rojas)
 * - Opción B: Contraseña única diferenciada por rol
 *   · Clave de conductores -> acceso al mapa (sin S-13)
 *   · Claves de administradores -> acceso completo + Reporte S-13
 * - Sesión persistente en sessionStorage (se cierra al cerrar el navegador)
 */

window.AuthSystem = (function () {

  // --- USUARIOS (agregar o modificar aqui) --------------------------------
  // Para agregar un nuevo admin, suma una entrada con rol: 'admin'
  // La clave de conductores es compartida y abre SOLO el mapa
  const USERS = [
    { nombre: 'Roman Suarez',      rol: 'admin',     password: 'roman2026'     },
    { nombre: 'Mauricio Ghirardi', rol: 'admin',     password: 'mauricio2026'  },
    { nombre: 'Direccion',         rol: 'admin',     password: 'direccion2026' },
    { nombre: 'Conductores',       rol: 'conductor', password: 'rojas2026'     }
  ];
  // ------------------------------------------------------------------------

  const SESSION_KEY = 'ct_rojas_session';

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(role, nombre) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, nombre, ts: Date.now() }));
    } catch {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  function getNombre() {
    const s = getSession();
    return s ? s.nombre : null;
  }

  function isAdmin()     { return getRole() === 'admin'; }
  function isConductor() { return getRole() === 'conductor'; }
  function isLoggedIn()  { return getRole() !== null; }

  // -- Inyectar pantalla de login en el DOM --------------------------------
  function showLoginScreen() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <style>
        #auth-overlay {
          position: fixed; inset: 0; z-index: 99999;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2027 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', 'Outfit', sans-serif;
          padding: 16px; box-sizing: border-box;
        }
        .auth-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 40px 36px 36px;
          width: 100%; max-width: 440px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
          animation: authFadeIn 0.4s ease;
          box-sizing: border-box;
        }
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .auth-logo { text-align: center; margin-bottom: 24px; }
        .auth-logo .logo-icon {
          font-size: 3rem; display: block; margin-bottom: 8px;
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(16,185,129,0.5)); }
          50%       { filter: drop-shadow(0 0 28px rgba(56,189,248,0.7)); }
        }
        .auth-logo h1 {
          font-size: 1.5rem; font-weight: 800; color: #f1f5f9;
          margin: 0 0 4px; letter-spacing: -0.5px;
        }
        .auth-logo p { font-size: 0.82rem; color: #64748b; margin: 0; }
        .auth-badge {
          display: inline-block;
          background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3);
          color: #6ee7b7; font-size: 0.72rem; font-weight: 600;
          padding: 2px 10px; border-radius: 100px; margin-top: 6px; letter-spacing: 0.5px;
        }
        .auth-access-info {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-bottom: 20px;
        }
        .auth-access-card {
          border-radius: 12px; padding: 12px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .auth-access-card.conductor {
          background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2);
        }
        .auth-access-card.admin {
          background: rgba(5,150,105,0.08); border: 1px solid rgba(5,150,105,0.2);
        }
        .auth-access-icon { font-size: 1.3rem; }
        .auth-access-title {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .auth-access-card.conductor .auth-access-title { color: #7dd3fc; }
        .auth-access-card.admin     .auth-access-title { color: #6ee7b7; }
        .auth-access-desc { font-size: 0.68rem; color: #64748b; line-height: 1.4; }
        .auth-divider {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
        }
        .auth-divider::before, .auth-divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08);
        }
        .auth-divider span {
          font-size: 0.68rem; color: #475569; white-space: nowrap;
          font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .auth-field { margin-bottom: 16px; }
        .auth-field label {
          display: block; font-size: 0.78rem; font-weight: 600;
          color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.3px;
        }
        .auth-input {
          width: 100%; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
          padding: 12px 16px; font-size: 0.95rem; color: #f1f5f9;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box; letter-spacing: 2px;
        }
        .auth-input:focus {
          border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
        .auth-input::placeholder { letter-spacing: 0; color: #475569; }
        .auth-btn {
          width: 100%; padding: 13px; border: none; border-radius: 12px;
          font-size: 0.95rem; font-weight: 700; cursor: pointer; margin-top: 8px;
          transition: all 0.2s; letter-spacing: 0.3px;
        }
        .auth-btn-primary {
          background: linear-gradient(135deg, #059669, #0284c7);
          color: white; box-shadow: 0 4px 20px rgba(5,150,105,0.35);
        }
        .auth-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(5,150,105,0.45); }
        .auth-btn-primary:active { transform: translateY(0); }
        .auth-error {
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5; border-radius: 8px; padding: 10px 14px;
          font-size: 0.82rem; margin-top: 12px; display: none; text-align: center;
        }
        .auth-footer { text-align: center; margin-top: 20px; font-size: 0.72rem; color: #334155; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60%  { transform: translateX(-8px); }
          40%, 80%  { transform: translateX(8px); }
        }
        .auth-shake { animation: shake 0.4s ease; }
      </style>

      <div class="auth-card" id="auth-card">
        <div class="auth-logo">
          <span class="logo-icon">&#x1F5FA;&#xFE0F;</span>
          <h1>Control Territorial</h1>
          <p>Reparto Urbano</p>
          <span class="auth-badge">Rojas, Buenos Aires</span>
        </div>

        <div class="auth-access-info">
          <div class="auth-access-card conductor">
            <span class="auth-access-icon">&#x1F6F5;</span>
            <span class="auth-access-title">Conductores</span>
            <span class="auth-access-desc">Acceso al mapa y gestion de manzanas</span>
          </div>
          <div class="auth-access-card admin">
            <span class="auth-access-icon">&#x1F464;</span>
            <span class="auth-access-title">Administracion</span>
            <span class="auth-access-desc">Mapa completo + Reporte S-13</span>
          </div>
        </div>

        <div class="auth-divider"><span>Ingresar contrasena</span></div>

        <div class="auth-field">
          <label for="auth-password-input">Contrasena de acceso</label>
          <input
            type="password"
            id="auth-password-input"
            class="auth-input"
            placeholder="Tu contrasena de conductor o admin"
            autocomplete="current-password"
            autofocus
          />
        </div>

        <button class="auth-btn auth-btn-primary" id="auth-submit-btn">
          Ingresar
        </button>

        <div class="auth-error" id="auth-error">
          Contrasena incorrecta. Intenta de nuevo.
        </div>

        <div class="auth-footer">
          Sistema de uso interno - Rojas, Bs. As.
        </div>
      </div>
    `;

    document.body.insertBefore(overlay, document.body.firstChild);

    const input = document.getElementById('auth-password-input');
    const btn   = document.getElementById('auth-submit-btn');
    const err   = document.getElementById('auth-error');
    const card  = document.getElementById('auth-card');

    function tryLogin() {
      const val = (input.value || '').trim();
      const match = USERS.find(u => u.password === val);
      if (match) {
        setSession(match.rol, match.nombre);
        dismissAndLaunch();
      } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
        card.classList.remove('auth-shake');
        void card.offsetWidth;
        card.classList.add('auth-shake');
      }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
  }

  function dismissAndLaunch() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(1.03)';
      overlay.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        overlay.remove();
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = '';
        applyRoleRestrictions();
      }, 300);
    }
  }

  // -- Restricciones segun rol ---------------------------------------------
  function applyRoleRestrictions() {
    const role = getRole();
    if (role === 'conductor') {
      // Los conductores no ven el boton S-13 ni la configuracion de Supabase
      ['#btn-open-settings', '#btn-open-s13'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });
    }
    addLogoutButton(role);
  }

  function addLogoutButton(role) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const nombre = getNombre();
    const roleIcon = role === 'admin' ? '&#x1F464;' : '&#x1F6F5;';
    const roleLabel = nombre ? `${roleIcon} ${nombre}` : (role === 'admin' ? 'Admin' : 'Conductor');
    const badge = document.createElement('div');
    badge.id = 'auth-role-badge';
    badge.title = 'Cerrar sesion';
    badge.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 5px 12px; font-size: 0.75rem;
      color: #94a3b8; cursor: pointer; user-select: none; transition: all 0.2s;
    `;
    badge.innerHTML = `<span>${roleLabel}</span><span style="font-size:0.65rem;color:#475569;margin-left:4px;">Salir x</span>`;
    badge.addEventListener('mouseenter', () => {
      badge.style.borderColor = 'rgba(239,68,68,0.4)';
      badge.style.color = '#fca5a5';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.borderColor = 'rgba(255,255,255,0.1)';
      badge.style.color = '#94a3b8';
    });
    badge.addEventListener('click', () => {
      if (confirm('Cerrar sesion?')) {
        clearSession();
        location.reload();
      }
    });

    headerActions.insertBefore(badge, headerActions.firstChild);
  }

  // -- Punto de entrada ----------------------------------------------------
  function init() {
    if (isLoggedIn()) {
      const appContainer = document.querySelector('.app-container');
      if (appContainer) appContainer.style.display = '';
      applyRoleRestrictions();
    } else {
      showLoginScreen();
    }
  }

  return { init, getRole, getNombre, isAdmin, isConductor, isLoggedIn, clearSession };

})();

// Auto-iniciar cuando el DOM este listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.AuthSystem.init);
} else {
  window.AuthSystem.init();
}
