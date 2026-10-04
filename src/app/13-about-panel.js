// Brief in-app help. Content is generated in the editor's language.
function initAboutPanel() {
  const panel = document.getElementById('about-panel');
  const overlay = document.getElementById('about-overlay');
  const closeBtn = document.getElementById('about-close-btn');
  const openButtons = ['btn-about', 'btn-mobile-help'].map(id => document.getElementById(id)).filter(Boolean);
  if (!panel || !closeBtn) return;
  let returnFocus = null;

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    overlay?.classList.remove('active');
    returnFocus?.focus();
  }
  for (const button of openButtons) button.addEventListener('click', () => {
    returnFocus = button;
    panel.inert = false;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('active');
    closeBtn.focus();
  });
  closeBtn.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (!panel.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      event.preventDefault();
      closeBtn.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', initAboutPanel);
