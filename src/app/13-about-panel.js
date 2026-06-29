// --- About Panel ---
function initAboutPanel() {
  const openBtn = document.getElementById('btn-about');
  const closeBtn = document.getElementById('about-close-btn');
  const overlay = document.getElementById('about-overlay');
  const panel = document.getElementById('about-panel');
  if (!openBtn || !panel) return;

  // Render translated content
  renderAboutContent();

  openBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openAboutPanel();
  });
  if (closeBtn) closeBtn.addEventListener('click', () => closeAboutPanel());
  if (overlay) overlay.addEventListener('click', () => closeAboutPanel());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closeAboutPanel();
    }
  });

  // Optimize bookmark title dynamically when pressing Ctrl+D / Cmd+D
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      const originalTitle = document.title;
      document.title = 'HTML Viewer';
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }
  });
}

function openAboutPanel() {
  const panel = document.getElementById('about-panel');
  const overlay = document.getElementById('about-overlay');
  if (!panel) return;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (overlay) overlay.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeAboutPanel() {
  const panel = document.getElementById('about-panel');
  const overlay = document.getElementById('about-overlay');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  if (overlay) overlay.classList.remove('active');
}

function renderAboutContent() {
  const body = document.getElementById('about-panel-body');
  if (!body) return;

  const features = [
    { icon: 'zap',          key: 'about_feat_live' },
    { icon: 'files',        key: 'about_feat_multi' },
    { icon: 'smartphone',   key: 'about_feat_responsive' },
    { icon: 'download',     key: 'about_feat_export' },
    { icon: 'code-2',       key: 'about_feat_monaco' },
    { icon: 'moon',         key: 'about_feat_theme' },
    { icon: 'globe',        key: 'about_feat_lang' },
    { icon: 'wifi-off',     key: 'about_feat_offline' },
  ];

  const faqs = [
    { q: 'about_faq_q1', a: 'about_faq_a1' },
    { q: 'about_faq_q2', a: 'about_faq_a2' },
    { q: 'about_faq_q3', a: 'about_faq_a3' },
    { q: 'about_faq_q4', a: 'about_faq_a4' },
    { q: 'about_faq_q5', a: 'about_faq_a5' },
  ];

  const shortcuts = [
    { keys: 'Ctrl + Z',         key: 'about_sc_undo' },
    { keys: 'Ctrl + Y',         key: 'about_sc_redo' },
    { keys: 'Ctrl + S',         key: 'about_sc_save' },
    { keys: 'Ctrl + +/−',       key: 'about_sc_zoom' },
    { keys: 'Ctrl + 0',         key: 'about_sc_reset_zoom' },
  ];

  body.innerHTML = `
    <section class="about-section">
      <h3>${t('about_what_title')}</h3>
      <img class="about-product-logo" src="/logo.png" width="96" height="96" loading="lazy" alt="HTML Viewer logo">
      <p>${t('about_what_desc')}</p>
      <p>${currentLocale === 'es' ? '2 modos de edición, 3 tamaños responsive y 4 rutas de exportación para proyectos estáticos.' : '2 editing modes, 3 responsive sizes and 4 export paths for browser-ready static projects.'}</p>
      <p>${currentLocale === 'es' ? 'La versión de junio de 2026 publica 10 páginas canónicas, combina 15 módulos fuente y usa objetivos móviles principales de 44 píxeles.' : 'The June 2026 release publishes 10 canonical pages, combines 15 source modules and uses 44-pixel primary mobile targets.'}</p>
      <p class="about-byline" data-author="HTML Viewer"><small>${currentLocale === 'es' ? 'Mantenido por HTML Viewer · Actualizado el 21 de junio de 2026.' : 'Maintained by HTML Viewer · Updated June 21, 2026.'}</small></p>
    </section>

    <section class="about-section">
      <h3>${t('about_features_title')}</h3>
      <div class="about-features-grid">
        ${features.map(f => `
          <div class="about-feature-card">
            <div class="about-feature-icon"><i data-lucide="${f.icon}"></i></div>
            <span>${t(f.key)}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="about-section">
      <h3>${t('about_faq_title')}</h3>
      <div class="about-faq-list">
        ${faqs.map(f => `
          <details class="about-faq-item">
            <summary>${t(f.q)}</summary>
            <p>${t(f.a)}</p>
          </details>
        `).join('')}
      </div>
    </section>

    <section class="about-section">
      <h3>${t('about_shortcuts_title')}</h3>
      <div class="about-shortcuts-list">
        ${shortcuts.map(s => `
          <div class="about-shortcut-row">
            <kbd>${s.keys}</kbd>
            <span>${t(s.key)}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="about-section">
      <h3>${t('about_resources_title')}</h3>
      <p>${t('about_resources_desc')}</p>
      <table class="about-comparison"><thead><tr><th>${currentLocale === 'es' ? 'Modo' : 'Mode'}</th><th>${currentLocale === 'es' ? 'Ideal para' : 'Best for'}</th></tr></thead><tbody><tr><td>Simple</td><td>${currentLocale === 'es' ? 'Fragmentos y documentos únicos' : 'Snippets and single documents'}</td></tr><tr><td>${currentLocale === 'es' ? 'Archivos' : 'Files'}</td><td>${currentLocale === 'es' ? 'Carpetas y recursos locales' : 'Folders and local assets'}</td></tr></tbody></table>
      <p><a href="/guides/">Documentation</a> · <a href="/legal/privacy/">Privacy Policy</a> · <a href="/legal/">Terms</a> · <a href="/legal/#contact">Contact</a> · <a href="/about/">About</a></p>
      <p><a href="https://html.spec.whatwg.org/" rel="external">WHATWG HTML</a> · <a href="https://developer.mozilla.org/en-US/docs/Web/CSS" rel="external">MDN CSS</a> · <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" rel="external">MDN JavaScript</a></p>
    </section>

    <footer class="about-footer">
      <p>${t('about_footer')}</p>
    </footer>
  `;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAboutPanel);
