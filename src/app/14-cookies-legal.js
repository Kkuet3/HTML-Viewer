// --- Cookies & Legal Notice Consent System ---
// Compliance with GDPR & LSSI-CE (Spain)
// Integrating Google Consent Mode v2 for Google Tag Manager (GTM)

(function() {
  const CONSENT_KEY = 'cookie-consent-preferences';

  function runWhenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // --- Google Consent Mode Integration ---
  function updateGoogleConsent(analytics, marketing) {
    if ((analytics || marketing) && typeof window.loadGTM === 'function') {
      window.loadGTM();
    }
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        'analytics_storage': analytics ? 'granted' : 'denied',
        'ad_storage': marketing ? 'granted' : 'denied',
        'ad_user_data': marketing ? 'granted' : 'denied',
        'ad_personalization': marketing ? 'granted' : 'denied'
      });
      // Push event to dataLayer
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'consent_updated',
        'consent_analytics': analytics,
        'consent_marketing': marketing
      });
    }
  }

  // --- Consent Storage ---
  function getSavedConsent() {
    try {
      const val = localStorage.getItem(CONSENT_KEY);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(analytics, marketing) {
    const preferences = { analytics, marketing, timestamp: Date.now() };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(preferences));
      updateGoogleConsent(analytics, marketing);
      
      // Call toast notify helper from 00-config-state.js if available
      if (typeof showToast === 'function') {
        showToast(t('cookie_consent_saved'), 'success');
      }
    } catch (e) {
      console.error("Could not save cookie consent:", e);
    }
  }

  // --- Cookie Banner UI ---
  function showCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'block';
  }

  // --- Cookies Settings Modal UI ---
  function openCookieSettingsModal() {
    const modal = document.getElementById('modal-cookies-settings');
    if (!modal) return;

    const banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'none';
    
    // Sync checkboxes with stored or default state
    const consent = getSavedConsent();
    const chkAnalytics = document.getElementById('chk-cookie-analytics');
    const chkMarketing = document.getElementById('chk-cookie-marketing');
    
    if (chkAnalytics) chkAnalytics.checked = consent ? !!consent.analytics : false;
    if (chkMarketing) chkMarketing.checked = consent ? !!consent.marketing : false;

    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  function closeCookieSettingsModal() {
    const modal = document.getElementById('modal-cookies-settings');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';

    if (!getSavedConsent()) {
      showCookieBanner();
    }
  }

  // --- Legal sliding panel UI ---
  function openLegalPanel(tabName) {
    const panel = document.getElementById('legal-panel');
    const overlay = document.getElementById('legal-overlay');
    if (!panel) return;

    // Render bilingual content
    renderLegalDocs();

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.classList.add('active');

    // Switch to correct tab
    switchLegalTab(tabName);

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function closeLegalPanel() {
    const panel = document.getElementById('legal-panel');
    const overlay = document.getElementById('legal-overlay');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.classList.remove('active');
  }

  function switchLegalTab(tabName) {
    // tabName is 'aviso', 'privacidad' or 'cookies'
    const targetId = `legal-tab-${tabName}`;
    
    // Update tabs buttons
    const buttons = document.querySelectorAll('.legal-tab-btn');
    buttons.forEach(btn => {
      const targetAttr = btn.getAttribute('data-target');
      if (targetAttr === targetId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update contents
    const contents = document.querySelectorAll('.legal-tab-content');
    contents.forEach(content => {
      if (content.id === targetId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  // --- Render Legal Notice, Privacy Policy, Cookies Policy ---
  function renderLegalDocs() {
    const isEs = (currentLocale === 'es');
    
    const avisoEl = document.getElementById('legal-tab-aviso');
    const privacyEl = document.getElementById('legal-tab-privacidad');
    const cookiesEl = document.getElementById('legal-tab-cookies');

    if (avisoEl) {
      avisoEl.innerHTML = isEs ? getAvisoEs() : getAvisoEn();
    }
    if (privacyEl) {
      privacyEl.innerHTML = isEs ? getPrivacyEs() : getPrivacyEn();
    }
    if (cookiesEl) {
      cookiesEl.innerHTML = isEs ? getCookiesEs() : getCookiesEn();
    }
  }

  // --- Dynamic HTML content strings ---
  function getAvisoEs() {
    return `
      <div class="legal-doc">
        <h3>1. Información General</h3>
        <p>En cumplimiento de lo previsto en la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa que este sitio web <strong>instantviewer.online</strong> (en adelante, "HTML Viewer") es una herramienta web de uso libre y gratuito. Para cualquier consulta, duda o contacto legal, puede comunicarse a través del correo electrónico <strong>guillemball09@gmail.com</strong>.</p>
        
        <h3>2. Naturaleza del Servicio</h3>
        <p>HTML Viewer es un editor de código HTML, CSS y JavaScript que procesa <strong>el código introducido por el usuario en su navegador</strong>. La aplicación no aloja ni guarda ese código como proyecto en una base de datos remota. La web puede solicitar recursos externos y, con consentimiento, analítica; esos servicios se describen por separado en las políticas de privacidad y cookies.</p>
        
        <h3>3. Condiciones de Uso y Exención de Responsabilidad</h3>
        <p>El usuario se compromete a hacer un uso lícito y ético de la herramienta. Dado que el renderizado de la previsualización del código cargado se ejecuta de forma aislada en el propio navegador del usuario final, HTML Viewer no se hace responsable en ningún caso del código, scripts, archivos o elementos visuales que los usuarios importen, escriban o prueben en la plataforma.</p>
        
        <h3>4. Enlaces a terceros</h3>
        <p>Esta web puede contener enlaces a sitios web de terceros (como tipografías de Google o CDNs de librerías). No nos hacemos responsables de las políticas de privacidad ni los contenidos de estos sitios externos.</p>
      </div>
    `;
  }

  function getAvisoEn() {
    return `
      <div class="legal-doc">
        <h3>1. General Information</h3>
        <p>In compliance with the provisions of Law 34/2002, of July 11, on Information Society Services and Electronic Commerce (LSSI-CE), we inform you that this website <strong>instantviewer.online</strong> (hereinafter, "HTML Viewer") is a free online web utility. For any legal inquiries or support, you may contact us at <strong>guillemball09@gmail.com</strong>.</p>
        
        <h3>2. Nature of the Service</h3>
        <p>HTML Viewer is an HTML, CSS, and JavaScript editor that processes <strong>user-written code in the browser</strong>. The application does not host or save that code as a project in a remote database. The website may request external resources and, with consent, analytics; those services are described separately in the privacy and cookie policies.</p>
        
        <h3>3. Terms of Use and Disclaimer</h3>
        <p>The user agrees to make appropriate and lawful use of the tool. Since the preview rendering of the loaded code executes isolated within the user's own browser, HTML Viewer is not responsible for any scripts, assets, markup, or features that users write, import, or test on the platform.</p>
        
        <h3>4. Third-Party Links</h3>
        <p>This website may link to third-party assets (such as Google Fonts or libraries CDNs). We are not responsible for the privacy policies or the content of these external sites.</p>
      </div>
    `;
  }

  function getPrivacyEs() {
    return `
      <div class="legal-doc">
        <h3>1. Privacidad y Seguridad</h3>
        <p>HTML Viewer procesa localmente el código y los archivos del proyecto y <strong>no los almacena como proyectos alojados</strong>. Las preferencias funcionales se guardan en el navegador y los servicios externos opcionales se detallan a continuación.</p>
        
        <h3>2. Recopilación de Estadísticas Técnicas</h3>
        <p>Únicamente si usted otorga su consentimiento expreso, utilizamos <strong>Google Analytics</strong> (a través de Google Tag Manager) para recopilar estadísticas de rendimiento y uso de la aplicación. Estos datos pueden incluir páginas vistas, tipo de dispositivo, país e idioma. Se procesan conforme a la configuración de consentimiento y a la política del proveedor para optimizar la interfaz y corregir fallos técnicos.</p>
        
        <h3>3. Conservación de Datos Locales</h3>
        <p>Las configuraciones de la aplicación (como el modo oscuro/claro y la división de pantalla) se guardan en el navegador del usuario utilizando <code>localStorage</code> para mantener la experiencia en visitas futuras. Puede vaciar este almacenamiento en cualquier momento limpiando los datos de navegación de su navegador.</p>
        
        <h3>4. Derechos de Privacidad</h3>
        <p>Dado que no registramos cuentas de usuario ni guardamos información identificativa en nuestros servidores, no disponemos de bases de datos para realizar rectificaciones o supresiones. No obstante, para cualquier consulta relacionada con la privacidad, puede escribir a <strong>guillemball09@gmail.com</strong>.</p>
      </div>
    `;
  }

  function getPrivacyEn() {
    return `
      <div class="legal-doc">
        <h3>1. Privacy and Security</h3>
        <p>HTML Viewer processes project code and files locally and <strong>does not store them as hosted projects</strong>. Functional preferences are stored in the browser, and optional external services are described below.</p>
        
        <h3>2. Collection of Technical Metrics</h3>
        <p>Only if you provide express consent, we use <strong>Google Analytics</strong> (via Google Tag Manager) to collect application usage and performance metrics. These may include pages viewed, device type, country, and language. They are processed according to the consent configuration and the provider's policy to improve the interface and troubleshoot technical issues.</p>
        
        <h3>3. Local Browser Storage</h3>
        <p>Application preferences (such as light/dark mode and splitter positions) are stored on your local device via <code>localStorage</code> to preserve your choices for future visits. You can clear this storage at any time by clearing your browser cache.</p>
        
        <h3>4. Data Subject Rights</h3>
        <p>Since we do not create user accounts or host personal information on our servers, we do not maintain databases to exercise rights of access, rectification, or erasure. However, for any privacy concerns, you are welcome to contact us at <strong>guillemball09@gmail.com</strong>.</p>
      </div>
    `;
  }

  function getCookiesEs() {
    return `
      <div class="legal-doc">
        <h3>1. ¿Qué son las cookies?</h3>
        <p>Una cookie es un pequeño archivo de texto enviado por un sitio web y almacenado en el navegador del usuario, de manera que el sitio web puede consultar la actividad previa del usuario y recordar preferencias.</p>
        
        <h3>2. Relación de Cookies Utilizadas</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Finalidad / Proveedor</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Tipo">Técnica (Necesaria)</td>
                <td data-label="Nombre">theme</td>
                <td data-label="Finalidad / Proveedor">Guarda la preferencia del tema visual (oscuro o claro).</td>
                <td data-label="Duración">Persistente (Local)</td>
              </tr>
              <tr>
                <td data-label="Tipo">Técnica (Necesaria)</td>
                <td data-label="Nombre">split-percent</td>
                <td data-label="Finalidad / Proveedor">Guarda el porcentaje de distribución vertical/horizontal del editor.</td>
                <td data-label="Duración">Persistente (Local)</td>
              </tr>
              <tr>
                <td data-label="Tipo">Técnica (Necesaria)</td>
                <td data-label="Nombre">cookie-consent-preferences</td>
                <td data-label="Finalidad / Proveedor">Almacena las preferencias de consentimiento de cookies del usuario.</td>
                <td data-label="Duración">Persistente (Local)</td>
              </tr>
              <tr>
                <td data-label="Tipo">Analítica (Consensual)</td>
                <td data-label="Nombre">_ga, _gid</td>
                <td data-label="Finalidad / Proveedor">Medición de visitas y análisis anónimo a través de Google Analytics.</td>
                <td data-label="Duración">2 años / 24h</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h3>3. Modificación del Consentimiento</h3>
        <p>Usted puede administrar o revocar sus opciones de consentimiento de cookies en cualquier momento pulsando el botón a continuación:</p>
        <button id="btn-reopen-cookies-from-policy" class="legal-btn-link">
          <i data-lucide="settings"></i> Gestionar preferencias de cookies
        </button>
      </div>
    `;
  }

  // --- Setup Event Listeners ---
  function getCookiesEn() {
    return `
      <div class="legal-doc">
        <h3>1. What are cookies?</h3>
        <p>A cookie is a small text file sent by a website and stored in the user's browser, allowing the website to retrieve previous activity and remember configuration details.</p>
        
        <h3>2. List of Cookies Used</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Purpose / Provider</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Type">Technical (Necessary)</td>
                <td data-label="Name">theme</td>
                <td data-label="Purpose / Provider">Stores the preferred visual theme (dark or light).</td>
                <td data-label="Duration">Persistent (Local)</td>
              </tr>
              <tr>
                <td data-label="Type">Technical (Necessary)</td>
                <td data-label="Name">split-percent</td>
                <td data-label="Purpose / Provider">Stores the vertical/horizontal split ratio of the editor panels.</td>
                <td data-label="Duration">Persistent (Local)</td>
              </tr>
              <tr>
                <td data-label="Type">Technical (Necessary)</td>
                <td data-label="Name">cookie-consent-preferences</td>
                <td data-label="Purpose / Provider">Stores the user's cookie consent choices.</td>
                <td data-label="Duration">Persistent (Local)</td>
              </tr>
              <tr>
                <td data-label="Type">Analytics (Consensual)</td>
                <td data-label="Name">_ga, _gid</td>
                <td data-label="Purpose / Provider">Measures page visits and anonymous metrics via Google Analytics.</td>
                <td data-label="Duration">2 years / 24 hours</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h3>3. Updating Your Consent Choices</h3>
        <p>You can manage or withdraw your cookie consent choices at any time by clicking the button below:</p>
        <button id="btn-reopen-cookies-from-policy" class="legal-btn-link">
          <i data-lucide="settings"></i> Manage cookie settings
        </button>
      </div>
    `;
  }

  function setupCookieEvents() {
    // Banner Accept All
    const btnAccept = document.getElementById('btn-cookies-accept');
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        saveConsent(true, true);
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.style.display = 'none';
      });
    }

    // Banner Reject All
    const btnReject = document.getElementById('btn-cookies-reject');
    if (btnReject) {
      btnReject.addEventListener('click', () => {
        saveConsent(false, false);
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.style.display = 'none';
      });
    }

    // Banner Configure
    const btnConfig = document.getElementById('btn-cookies-config');
    if (btnConfig) {
      btnConfig.addEventListener('click', () => {
        openCookieSettingsModal();
      });
    }

    // Modal Close
    const btnModalClose = document.getElementById('modal-cookies-close');
    if (btnModalClose) {
      btnModalClose.addEventListener('click', () => {
        closeCookieSettingsModal();
      });
    }

    const modalOverlay = document.getElementById('modal-cookies-settings');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          closeCookieSettingsModal();
        }
      });
    }

    // Modal Save Preferences
    const btnModalSave = document.getElementById('btn-cookies-save');
    if (btnModalSave) {
      btnModalSave.addEventListener('click', () => {
        const chkAnalytics = document.getElementById('chk-cookie-analytics');
        const chkMarketing = document.getElementById('chk-cookie-marketing');
        
        const analytics = chkAnalytics ? chkAnalytics.checked : false;
        const marketing = chkMarketing ? chkMarketing.checked : false;
        
        saveConsent(analytics, marketing);
        closeCookieSettingsModal();
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.style.display = 'none';
      });
    }
  }

  function setupLegalPanelEvents() {
    // Sidebar Links
    const btnAviso = document.getElementById('btn-legal-aviso');
    const btnPrivacidad = document.getElementById('btn-legal-privacidad');
    const btnCookies = document.getElementById('btn-legal-cookies');

    if (btnAviso) btnAviso.addEventListener('click', (event) => { event.preventDefault(); openLegalPanel('aviso'); });
    if (btnPrivacidad) btnPrivacidad.addEventListener('click', (event) => { event.preventDefault(); openLegalPanel('privacidad'); });
    if (btnCookies) btnCookies.addEventListener('click', (event) => { event.preventDefault(); openLegalPanel('cookies'); });

    // Drawer Close Buttons
    const btnClose = document.getElementById('legal-close-btn');
    if (btnClose) btnClose.addEventListener('click', closeLegalPanel);

    const overlay = document.getElementById('legal-overlay');
    if (overlay) overlay.addEventListener('click', closeLegalPanel);

    // Tab buttons in drawer header
    const tabNavButtons = document.querySelectorAll('.legal-tab-btn');
    tabNavButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const tabName = target.replace('legal-tab-', '');
        switchLegalTab(tabName);
      });
    });

    // Event delegation for the dynamic reopen button inside Cookies Policy tab
    const panelBody = document.getElementById('legal-panel-body');
    if (panelBody) {
      panelBody.addEventListener('click', (e) => {
        const reopenBtn = e.target.closest('#btn-reopen-cookies-from-policy');
        if (reopenBtn) {
          closeLegalPanel();
          openCookieSettingsModal();
        }
      });
    }

    // Keyboard support for ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = document.getElementById('legal-panel');
        if (panel && panel.classList.contains('open')) {
          closeLegalPanel();
        }
        
        const modal = document.getElementById('modal-cookies-settings');
        if (modal && modal.classList.contains('active')) {
          closeCookieSettingsModal();
        }
      }
    });
  }

  // --- Initializer ---
  function initCookieConsent() {
    const consent = getSavedConsent();
    if (!consent) {
      showCookieBanner();
    } else {
      updateGoogleConsent(consent.analytics, consent.marketing);
    }
  }

  // Run on DOM ready
  runWhenReady(() => {
    initCookieConsent();
    setupCookieEvents();
    setupLegalPanelEvents();
  });
})();
