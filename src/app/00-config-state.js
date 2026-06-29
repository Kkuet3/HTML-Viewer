// Modern HTML Online Viewer Application logic
// Redesigned with artificialanalysis.ai data-dense aesthetics

// Matches the CSS breakpoint where the fixed sidebar and both panel minima stop fitting.
const COMPACT_LAYOUT_MAX_WIDTH = 1152;

// --- Language & Translation System ---
let currentLocale = 'en'; // default and crawler-facing language
try {
  const requestedLocale = new URLSearchParams(window.location.search).get('lang');
  const browserLang = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
  if (requestedLocale === 'es' || (!requestedLocale && browserLang.startsWith('es'))) {
    currentLocale = 'es';
  }
} catch (e) {
  // Ignore, keep English
}

const TRANSLATIONS = {
  es: {
    "sidebar_preview": "Página completa",
    "sidebar_focus": "Modo Enfoque",
    "sidebar_import": "Importar Proyecto",
    "sidebar_export": "Exportar HTML",
    "sidebar_sample": "Cargar Ejemplo",
    "sidebar_clear": "Limpiar Todo",
    "sidebar_mode_dark": "Modo Oscuro",
    "sidebar_mode_light": "Modo Claro",
    "cat_view": "Vista",
    "cat_file": "Archivo",
    "cat_file_unified": "Documento",
    "cat_file_split": "Proyecto",
    "sidebar_import_unified": "Importar HTML",
    "sidebar_import_split": "Importar Proyecto",
    "sidebar_export_unified": "Descargar HTML",
    "sidebar_export_split": "Exportar Proyecto",
    "cat_actions": "Acciones",
    "mobile_code": "Código",
    "mobile_view": "Vista",
    "mobile_open_menu": "Abrir menú",
    "mobile_close_menu": "Cerrar menú",
    "toggle_explorer_title": "Mostrar/ocultar menú de archivos",
    "no_file_selected": "Ningún archivo seleccionado",
    "tooltip_undo": "Deshacer (Ctrl+Z)",
    "tooltip_redo": "Rehacer (Ctrl+Y)",
    "label_undo": "Deshacer",
    "label_redo": "Rehacer",
    "mode_unified": "Simple",
    "mode_split": "Archivos",
    "mode_unified_title": "Archivo único",
    "mode_split_title": "Archivos separados",
    "choose_file": "Elegir archivo",
    "upload_files": "Subir archivos",
    "new_file": "Nuevo archivo",
    "new_folder": "Nueva carpeta",
    "rename": "Renombrar",
    "delete": "Eliminar",
    "rename_folder": "Renombrar carpeta",
    "rename_file": "Renombrar archivo",
    "delete_folder": "Eliminar carpeta",
    "delete_file": "Eliminar archivo",
    "open_preview": "Abrir en vista previa",
    "reload_preview": "Volver a cargar este HTML en la vista previa",
    "choose_file_selector_title": "Abre el selector de archivos para elegir uno",
    "change_file_aria": "Cambiar archivo. Actual: {name}",
    "placeholder_html": "Escribe aquí tu HTML",
    "placeholder_css": "Escribe aquí tu CSS",
    "placeholder_js": "Escribe aquí tu JavaScript",
    "placeholder_json": "Escribe aquí tu JSON",
    "placeholder_md": "Escribe aquí tu Markdown",
    "placeholder_code": "Escribe aquí tu código",
    "placeholder_open_file": "Abre un archivo para comenzar a editar",
    "btn_path": "Ruta",
    "btn_img": "img",
    "btn_css": "CSS",
    "title_path": "Copiar ruta",
    "title_img": "Copiar etiqueta de imagen",
    "title_css": "Copiar url CSS",
    "emulator_reload": "Recargar previsualización",
    "emulator_home": "Volver a la página inicial",
    "emulator_desktop": "Escritorio",
    "emulator_tablet": "Tablet",
    "emulator_mobile": "Móvil",
    "emulator_desktop_title": "Vista de escritorio",
    "emulator_tablet_title": "Vista de tablet",
    "emulator_mobile_title": "Vista móvil",
    "drag_title_import": "Suelta para importar archivos",
    "drag_desc_import": "Puedes soltar en cualquier zona de la aplicación",
    "drag_title_add": "Suelta aquí para añadir al proyecto",
    "drag_desc_add": "Los archivos se conservarán dentro del proyecto actual",
    "drag_title_project": "Suelta para importar proyecto",
    "drag_title_html": "Suelta para abrir HTML",
    "drag_desc_files": "El archivo se añadirá al proyecto automáticamente",
    "drag_desc_main": "La importación se abrirá como contenido principal",
    "export_title": "Exportar Proyecto",
    "export_subtitle": "Elige el formato de salida para guardar tu código",
    "export_local_title": "Carpeta Local",
    "export_local_desc": "Guarda los archivos directamente en una carpeta local (requiere soporte de navegador)",
    "export_local_unsupported": "No Soportado",
    "export_zip_title": "Archivo ZIP",
    "export_zip_desc": "Empaqueta todos los archivos virtuales en un archivo comprimido .zip descargable",
    "export_unified_title": "Exportar como HTML único",
    "export_unified_desc": "Compila y une todos los archivos en un único HTML listo para producción",
    "toast_offline_mode": "Modo sin conexión activado (editor básico)",
    "toast_popup_blocked": "El navegador bloqueó la ventana emergente",
    "toast_project_opened_virtual": "Proyecto abierto como URL virtual",
    "toast_full_page_opened": "Visualización a página completa abierta",
    "toast_page_open_error": "Error al abrir la página",
    "toast_sample_loaded": "Código de ejemplo cargado",
    "toast_editor_cleared": "Editor vaciado",
    "toast_format_not_supported": "Formato no soportado. Selecciona un archivo .html o .zip",
    "toast_files_added": "{count} archivo(s) añadidos",
    "toast_file_exported_as": "Archivo exportado como {name}",
    "toast_export_error": "Error al exportar el archivo",
    "toast_jszip_not_loaded": "La librería JSZip no está cargada. Comprueba tu conexión a Internet.",
    "toast_project_exported_zip": "Proyecto exportado como ZIP: {name}",
    "toast_zip_generate_error": "Error al generar el archivo ZIP",
    "toast_local_export_unsupported": "Tu navegador no soporta la exportación a carpeta local.",
    "toast_local_export_success": "Proyecto exportado con éxito a la carpeta local",
    "toast_export_cancelled": "Exportación cancelada por el usuario",
    "toast_folder_export_error": "Error al exportar a carpeta: {message}",
    "toast_html_imported": "Archivo HTML importado: {name}",
    "toast_html_read_error": "Error al leer el archivo HTML",
    "toast_zip_no_valid_files": "No se encontraron archivos válidos dentro del ZIP",
    "toast_zip_import_error": "Error al importar el archivo ZIP",
    "toast_no_valid_import": "No se encontraron archivos válidos para importar",
    "toast_file_added_to_project": "archivo añadido al proyecto",
    "toast_files_added_to_project": "archivos añadidos al proyecto",
    "toast_folder_imported": "Carpeta importada con éxito: {count} archivos/carpetas cargados",
    "toast_folder_import_error": "Error al importar la carpeta soltada",
    "toast_unified_html_exported": "HTML unificado exportado como {name}",
    "toast_unified_export_error": "Error al exportar HTML unificado",
    "toast_clipboard_error": "No se pudo copiar al portapapeles",
    "toast_path_copied": "Ruta copiada",
    "toast_img_tag_copied": "Etiqueta img copiada",
    "toast_css_url_copied": "URL CSS copiada",
    "toast_move_outside_root_error": "No se pueden mover elementos fuera de la carpeta madre",
    "toast_file_exists_in_folder": "Ya existe un archivo con ese nombre en esa carpeta",
    "toast_move_inside_self_error": "No se puede mover una carpeta dentro de sí misma",
    "toast_folder_exists_in_location": "Ya existe una carpeta con ese nombre en esa ubicación",
    "toast_files_updated_paths": "{count} archivo(s) actualizados con rutas nuevas",
    "toast_files_added_to_root": "{count} archivo(s) añadidos a la raíz",
    "toast_files_added_to_folder": "{count} archivo(s) añadidos a {name}",
    "toast_folder_name_invalid": "El nombre de la carpeta no puede contener \ / : * ? \" < > |",
    "toast_folder_renamed": "Carpeta renombrada a {name}",
    "toast_references_updated": "{count} referencia(s) actualizadas",
    "toast_cannot_delete_folder_preview": "No se puede eliminar la carpeta porque contiene el HTML abierto en la vista previa",
    "toast_folder_deleted": "Carpeta \"{name}\" eliminada",
    "toast_cannot_delete_file_preview": "No se puede eliminar el HTML abierto en la vista previa",
    "toast_file_deleted": "Archivo eliminado: {name}",
    "toast_file_name_invalid": "El nombre del archivo no puede contener \ / : * ? \" < > |",
    "toast_file_renamed": "Archivo renombrado a {name}",
    "default_folder_name": "proyecto",
    "default_file_name": "archivo",
    "imported_project_name": "proyecto-importado",
    "sidebar_about": "Acerca de",
    "about_title": "Acerca de HTML Viewer",
    "about_what_title": "¿Qué es HTML Viewer?",
    "about_what_desc": "HTML Viewer es un editor de código web gratuito que se ejecuta directamente en tu navegador. Escribe, edita y previsualiza HTML, CSS y JavaScript en tiempo real sin instalación ni registro. Ideal para desarrolladores web, estudiantes y diseñadores que necesitan prototipar rápidamente, probar fragmentos de código o aprender desarrollo web de forma interactiva.",
    "about_features_title": "Características principales",
    "about_feat_live": "Vista previa en tiempo real",
    "about_feat_multi": "Editor multi-archivo",
    "about_feat_responsive": "Test responsive",
    "about_feat_export": "Importar / Exportar",
    "about_feat_monaco": "Editor Monaco",
    "about_feat_theme": "Tema oscuro y claro",
    "about_feat_lang": "Bilingüe (ES/EN)",
    "about_feat_offline": "Funciona sin conexión",
    "about_faq_title": "Preguntas frecuentes",
    "about_faq_q1": "¿Es gratis HTML Viewer?",
    "about_faq_a1": "Sí, HTML Viewer es completamente gratuito. No hay planes de pago, registro ni anuncios. Todos los archivos se procesan localmente en tu navegador.",
    "about_faq_q2": "¿Se guarda mi código en algún servidor?",
    "about_faq_a2": "El código que escribes se procesa y guarda localmente en tu navegador. La analítica opcional y los recursos externos se explican por separado en las políticas de privacidad y cookies.",
    "about_faq_q3": "¿Puedo usar HTML Viewer sin conexión a Internet?",
    "about_faq_a3": "Sí. Una vez cargada la página, el editor funciona completamente offline. Puedes escribir, previsualizar y exportar tu código sin conexión.",
    "about_faq_q4": "¿Qué navegadores son compatibles?",
    "about_faq_a4": "HTML Viewer funciona en todos los navegadores modernos: Chrome, Firefox, Safari, Edge y Opera. Recomendamos Chrome o Edge para la mejor experiencia con el editor Monaco.",
    "about_faq_q5": "¿Puedo trabajar con proyectos de múltiples archivos?",
    "about_faq_a5": "Sí. Cambia al modo Archivos para crear proyectos con múltiples archivos HTML, CSS, JS e imágenes organizados en carpetas. Puedes importar y exportar proyectos como ZIP.",
    "about_shortcuts_title": "Atajos de teclado",
    "about_resources_title": "Guías y documentación",
    "about_resources_desc": "Aprende a usar la vista previa, los proyectos multi-archivo y la importación o exportación ZIP.",
    "about_sc_undo": "Deshacer",
    "about_sc_redo": "Rehacer",
    "about_sc_save": "Exportar archivo",
    "about_sc_zoom": "Aumentar/Reducir zoom",
    "about_sc_reset_zoom": "Restablecer zoom",
    "about_footer": "Hecho con ❤ para la comunidad de desarrollo web.",
    "legal_notice_title": "Información Legal",
    "legal_aviso_short": "Aviso Legal",
    "legal_privacidad_short": "Privacidad",
    "legal_cookies_short": "Cookies",
    "guides_short": "Guías",
    "cookie_banner_title": "Control de Cookies",
    "cookie_banner_desc": "Utilizamos cookies propias y de terceros para analizar el uso de nuestra web y mejorar su experiencia. Puede configurar o rechazar su uso pulsando en Configurar.",
    "cookie_btn_configure": "Configurar",
    "cookie_btn_reject_all": "Rechazar todas",
    "cookie_btn_accept_all": "Aceptar todas",
    "cookie_modal_title": "Configuración de Cookies",
    "cookie_modal_desc": "Gestione sus preferencias de privacidad y consentimiento de cookies.",
    "cookie_cat_necessary_title": "Cookies Técnicas / Necesarias",
    "cookie_cat_necessary_desc": "Permiten funciones básicas como la navegación y la persistencia de configuraciones (ej. tema visual, división de pantalla). No se pueden desactivar.",
    "cookie_cat_analytics_title": "Cookies de Análisis / Estadísticas",
    "cookie_cat_analytics_desc": "Nos ayudan a entender cómo interactúan los usuarios con la web, detectando errores y midiendo el rendimiento de forma anónima a través de Google Analytics.",
    "cookie_cat_marketing_title": "Cookies de Marketing / Publicitarias",
    "cookie_cat_marketing_desc": "Se utilizan para realizar el seguimiento de los visitantes en la web con el fin de mostrar anuncios que sean relevantes y atractivos para el usuario.",
    "cookie_cat_always_active": "Obligatorio",
    "cookie_btn_save_preferences": "Guardar Preferencias",
    "cookie_consent_saved": "Preferencias de cookies guardadas"
  },
  en: {
    "sidebar_preview": "Full Page",
    "sidebar_focus": "Focus Mode",
    "sidebar_import": "Import Project",
    "sidebar_export": "Export HTML",
    "sidebar_sample": "Load Example",
    "sidebar_clear": "Clear All",
    "sidebar_mode_dark": "Dark Mode",
    "sidebar_mode_light": "Light Mode",
    "cat_view": "View",
    "cat_file": "File",
    "cat_file_unified": "Document",
    "cat_file_split": "Project",
    "sidebar_import_unified": "Import HTML",
    "sidebar_import_split": "Import Project",
    "sidebar_export_unified": "Download HTML",
    "sidebar_export_split": "Export Project",
    "cat_actions": "Actions",
    "mobile_code": "Code",
    "mobile_view": "Preview",
    "mobile_open_menu": "Open menu",
    "mobile_close_menu": "Close menu",
    "toggle_explorer_title": "Toggle file explorer",
    "no_file_selected": "No file selected",
    "tooltip_undo": "Undo (Ctrl+Z)",
    "tooltip_redo": "Redo (Ctrl+Y)",
    "label_undo": "Undo",
    "label_redo": "Redo",
    "mode_unified": "Simple",
    "mode_split": "Files",
    "mode_unified_title": "Single file",
    "mode_split_title": "Separate files",
    "choose_file": "Choose file",
    "upload_files": "Upload files",
    "new_file": "New file",
    "new_folder": "New folder",
    "rename": "Rename",
    "delete": "Delete",
    "rename_folder": "Rename folder",
    "rename_file": "Rename file",
    "delete_folder": "Delete folder",
    "delete_file": "Delete file",
    "open_preview": "Open in preview",
    "reload_preview": "Reload this HTML in preview",
    "choose_file_selector_title": "Open the file chooser to select one",
    "change_file_aria": "Change file. Current: {name}",
    "placeholder_html": "Write your HTML here",
    "placeholder_css": "Write your CSS here",
    "placeholder_js": "Write your JavaScript here",
    "placeholder_json": "Write your JSON here",
    "placeholder_md": "Write your Markdown here",
    "placeholder_code": "Write your code here",
    "placeholder_open_file": "Open a file to start editing",
    "btn_path": "Path",
    "btn_img": "img",
    "btn_css": "CSS",
    "title_path": "Copy path",
    "title_img": "Copy image tag",
    "title_css": "Copy CSS URL",
    "emulator_reload": "Reload preview",
    "emulator_home": "Return to the home page",
    "emulator_desktop": "Desktop",
    "emulator_tablet": "Tablet",
    "emulator_mobile": "Mobile",
    "emulator_desktop_title": "Desktop view",
    "emulator_tablet_title": "Tablet view",
    "emulator_mobile_title": "Mobile view",
    "drag_title_import": "Drop to import files",
    "drag_desc_import": "You can drop anywhere on the application",
    "drag_title_add": "Drop here to add to the project",
    "drag_desc_add": "Files will be kept inside the current project",
    "drag_title_project": "Drop to import project",
    "drag_title_html": "Drop to open HTML",
    "drag_desc_files": "The file will be added to the project automatically",
    "drag_desc_main": "The import will be opened as main content",
    "export_title": "Export Project",
    "export_subtitle": "Choose the output format to save your code",
    "export_local_title": "Local Folder",
    "export_local_desc": "Save files directly to a local folder (requires browser support)",
    "export_local_unsupported": "Unsupported",
    "export_zip_title": "ZIP File",
    "export_zip_desc": "Package all virtual files into a downloadable compressed .zip file",
    "export_unified_title": "Export as single HTML",
    "export_unified_desc": "Compile and merge all files into a single HTML ready for production",
    "toast_offline_mode": "Offline mode activated (basic editor)",
    "toast_popup_blocked": "The browser blocked the pop-up window",
    "toast_project_opened_virtual": "Project opened as virtual URL",
    "toast_full_page_opened": "Full page preview opened",
    "toast_page_open_error": "Error opening page",
    "toast_sample_loaded": "Sample code loaded",
    "toast_editor_cleared": "Editor cleared",
    "toast_format_not_supported": "Format not supported. Select a .html or .zip file",
    "toast_files_added": "{count} file(s) added",
    "toast_file_exported_as": "File exported as {name}",
    "toast_export_error": "Error exporting file",
    "toast_jszip_not_loaded": "The JSZip library is not loaded. Check your Internet connection.",
    "toast_project_exported_zip": "Project exported as ZIP: {name}",
    "toast_zip_generate_error": "Error generating ZIP file",
    "toast_local_export_unsupported": "Your browser does not support local folder export.",
    "toast_local_export_success": "Project successfully exported to local folder",
    "toast_export_cancelled": "Export cancelled by user",
    "toast_folder_export_error": "Error exporting to folder: {message}",
    "toast_html_imported": "HTML file imported: {name}",
    "toast_html_read_error": "Error reading HTML file",
    "toast_zip_no_valid_files": "No valid files found inside the ZIP",
    "toast_zip_import_error": "Error importing ZIP file",
    "toast_no_valid_import": "No valid files found to import",
    "toast_file_added_to_project": "file added to project",
    "toast_files_added_to_project": "files added to project",
    "toast_folder_imported": "Folder successfully imported: {count} files/folders loaded",
    "toast_folder_import_error": "Error importing dropped folder",
    "toast_unified_html_exported": "Unified HTML exported as {name}",
    "toast_unified_export_error": "Error exporting unified HTML",
    "toast_clipboard_error": "Could not copy to clipboard",
    "toast_path_copied": "Path copied",
    "toast_img_tag_copied": "img tag copied",
    "toast_css_url_copied": "CSS URL copied",
    "toast_move_outside_root_error": "Cannot move elements outside the root folder",
    "toast_file_exists_in_folder": "A file with that name already exists in that folder",
    "toast_move_inside_self_error": "Cannot move a folder inside itself",
    "toast_folder_exists_in_location": "A folder with that name already exists in that location",
    "toast_files_updated_paths": "{count} file(s) updated with new paths",
    "toast_files_added_to_root": "{count} file(s) added to root",
    "toast_files_added_to_folder": "{count} file(s) added to {name}",
    "toast_folder_name_invalid": "Folder name cannot contain \ / : * ? \" < > |",
    "toast_folder_renamed": "Folder renamed to {name}",
    "toast_references_updated": "{count} reference(s) updated",
    "toast_cannot_delete_folder_preview": "Cannot delete the folder because it contains the HTML open in the preview",
    "toast_folder_deleted": "Folder \"{name}\" deleted",
    "toast_cannot_delete_file_preview": "Cannot delete the HTML open in the preview",
    "toast_file_deleted": "File deleted: {name}",
    "toast_file_name_invalid": "File name cannot contain \ / : * ? \" < > |",
    "toast_file_renamed": "File renamed to {name}",
    "default_folder_name": "project",
    "default_file_name": "file",
    "imported_project_name": "imported-project",
    "sidebar_about": "About",
    "about_title": "About HTML Viewer",
    "about_what_title": "What is HTML Viewer?",
    "about_what_desc": "HTML Viewer is a free, browser-based code editor for web development. Write, edit, and preview HTML, CSS, and JavaScript in real-time with no installation or signup required. Perfect for web developers, students, and designers who need to rapidly prototype, test code snippets, or learn web development interactively.",
    "about_features_title": "Key Features",
    "about_feat_live": "Live real-time preview",
    "about_feat_multi": "Multi-file editor",
    "about_feat_responsive": "Responsive testing",
    "about_feat_export": "Import / Export",
    "about_feat_monaco": "Monaco Editor",
    "about_feat_theme": "Dark & Light theme",
    "about_feat_lang": "Bilingual (EN/ES)",
    "about_feat_offline": "Works offline",
    "about_faq_title": "Frequently Asked Questions",
    "about_faq_q1": "Is HTML Viewer free?",
    "about_faq_a1": "Yes, HTML Viewer is completely free. There are no paid plans, no registration required, and no ads. All files are processed locally in your browser.",
    "about_faq_q2": "Is my code stored on any server?",
    "about_faq_a2": "The code you write is processed and stored locally in your browser. Optional analytics and externally hosted resources are explained separately in the privacy and cookie policies.",
    "about_faq_q3": "Can I use HTML Viewer without an Internet connection?",
    "about_faq_a3": "Yes. Once the page is loaded, the editor works fully offline. You can write, preview, and export your code without a connection.",
    "about_faq_q4": "Which browsers are supported?",
    "about_faq_a4": "HTML Viewer works on all modern browsers: Chrome, Firefox, Safari, Edge, and Opera. We recommend Chrome or Edge for the best experience with the Monaco editor.",
    "about_faq_q5": "Can I work with multi-file projects?",
    "about_faq_a5": "Yes. Switch to Files mode to create projects with multiple HTML, CSS, JS, and image files organized in folders. You can import and export projects as ZIP archives.",
    "about_shortcuts_title": "Keyboard Shortcuts",
    "about_resources_title": "Guides and documentation",
    "about_resources_desc": "Learn live preview, multi-file projects and reliable ZIP import or export workflows.",
    "about_sc_undo": "Undo",
    "about_sc_redo": "Redo",
    "about_sc_save": "Export file",
    "about_sc_zoom": "Zoom in/out",
    "about_sc_reset_zoom": "Reset zoom",
    "about_footer": "Made with ❤ for the web development community.",
    "legal_notice_title": "Legal Information",
    "legal_aviso_short": "Legal Notice",
    "legal_privacidad_short": "Privacy",
    "legal_cookies_short": "Cookies",
    "guides_short": "Guides",
    "cookie_banner_title": "Cookie Control",
    "cookie_banner_desc": "We use our own and third-party cookies to analyze the use of our website and improve your experience. You can configure or reject their use by clicking Configure.",
    "cookie_btn_configure": "Configure",
    "cookie_btn_reject_all": "Reject all",
    "cookie_btn_accept_all": "Accept all",
    "cookie_modal_title": "Cookie Settings",
    "cookie_modal_desc": "Manage your privacy preferences and cookie consent.",
    "cookie_cat_necessary_title": "Technical / Necessary Cookies",
    "cookie_cat_necessary_desc": "Enable basic functions such as navigation and persistence of settings (e.g. visual theme, screen split). They cannot be disabled.",
    "cookie_cat_analytics_title": "Analytics / Statistical Cookies",
    "cookie_cat_analytics_desc": "Help us understand how users interact with the website, detecting errors and measuring performance anonymously through Google Analytics.",
    "cookie_cat_marketing_title": "Marketing / Advertising Cookies",
    "cookie_cat_marketing_desc": "Used to track visitors across the website in order to display ads that are relevant and engaging for the user.",
    "cookie_cat_always_active": "Required",
    "cookie_btn_save_preferences": "Save Preferences",
    "cookie_consent_saved": "Cookie preferences saved"
  }
};

function t(key, replacements = {}) {
  const dict = TRANSLATIONS[currentLocale] || TRANSLATIONS['en'];
  let text = dict[key] || TRANSLATIONS['en'][key] || key;
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }
  return text;
}

function applyLocale() {
  document.documentElement.setAttribute('lang', currentLocale);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', t(key));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', t(key));
  });
  updateSidebarTexts();
}

function updateSidebarTexts() {
  const catFileEl = document.querySelector('[data-i18n="cat_file"]');
  const importTextEl = document.querySelector('[data-i18n="sidebar_import"]');
  const exportTextEl = document.querySelector('[data-i18n="sidebar_export"]');

  if (catFileEl) {
    catFileEl.textContent = t(editorMode === 'unified' ? 'cat_file_unified' : 'cat_file_split');
  }
  if (importTextEl) {
    importTextEl.textContent = t(editorMode === 'unified' ? 'sidebar_import_unified' : 'sidebar_import_split');
  }
  if (exportTextEl) {
    exportTextEl.textContent = t(editorMode === 'unified' ? 'sidebar_export_unified' : 'sidebar_export_split');
  }
}

const INITIAL_EDITOR_CODE = '';
const EDITOR_PLACEHOLDER_TEXT = currentLocale === 'es' ? 'Escribe aquí tu HTML' : 'Write your HTML here';

const DEFAULT_SAMPLE_CODE_ES = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Una nota sobre el silencio</title>
</head>
<body style="background:#f4f1ea; margin:0; padding:80px 24px; font-family:Georgia, 'Times New Roman', serif; color:#2b2722;">

  <article style="max-width:560px; margin:0 auto;">

    <p style="font-family:Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#9a8f7d; margin:0 0 28px;">
      Cuaderno &mdash; primera entrada
    </p>

    <h1 style="font-size:34px; line-height:1.25; margin:0 0 24px; font-weight:normal;">
      El silencio también tiene forma
    </h1>

    <p style="font-size:17px; line-height:1.8; margin:0 0 20px;">
      No es la ausencia de sonido, sino el espacio que queda cuando algo termina de decirse.
      Entre dos frases hay siempre una pausa más honesta que las palabras que la rodean.
    </p>

    <p style="font-size:17px; line-height:1.8; margin:0 0 20px;">
      Escribir bien no es llenar la página. Es saber cuánto dejar fuera de ella.
    </p>

    <hr style="border:none; border-top:1px solid #ddd6c7; margin:36px 0;">

    <p style="font-family:Helvetica, Arial, sans-serif; font-size:13px; letter-spacing:1px; color:#9a8f7d; margin:0;">
      &mdash; A.
    </p>

  </article>

</body>
</html>`;

const DEFAULT_SAMPLE_CODE_EN = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>A note on silence</title>
</head>
<body style="background:#f4f1ea; margin:0; padding:80px 24px; font-family:Georgia, 'Times New Roman', serif; color:#2b2722;">

  <article style="max-width:560px; margin:0 auto;">

    <p style="font-family:Helvetica, Arial, sans-serif; font-size:12px; letter-spacing:3px; text-transform:uppercase; color:#9a8f7d; margin:0 0 28px;">
      Notebook &mdash; first entry
    </p>

    <h1 style="font-size:34px; line-height:1.25; margin:0 0 24px; font-weight:normal;">
      Silence also has a shape
    </h1>

    <p style="font-size:17px; line-height:1.8; margin:0 0 20px;">
      It is not the absence of sound, but the space that remains when something finished being said.
      Between two sentences there is always a pause more honest than the words that surround it.
    </p>

    <p style="font-size:17px; line-height:1.8; margin:0 0 20px;">
      Writing well is not about filling the page. It is knowing how much to leave out of it.
    </p>

    <hr style="border:none; border-top:1px solid #ddd6c7; margin:36px 0;">

    <p style="font-family:Helvetica, Arial, sans-serif; font-size:13px; letter-spacing:1px; color:#9a8f7d; margin:0;">
      &mdash; A.
    </p>

  </article>

</body>
</html>`;

const DEFAULT_SAMPLE_CODE = currentLocale === 'es' ? DEFAULT_SAMPLE_CODE_ES : DEFAULT_SAMPLE_CODE_EN;

const PREVIEW_IDLE_LABEL = currentLocale === 'es' ? 'Activo' : 'Active';
const PREVIEW_RENDERING_LABEL = currentLocale === 'es' ? 'Renderizando' : 'Rendering';
const PREVIEW_READY_LABEL = currentLocale === 'es' ? 'Listo' : 'Ready';
const PREVIEW_NOT_FOUND_LABEL = currentLocale === 'es' ? 'No encontrado' : 'Not found';
const MONACO_VERSION = '0.39.0';
const MONACO_BASE_PATH = `assets/vendor/monaco-editor/${MONACO_VERSION}/min/vs`;
const MONACO_LOADER_PATH = `${MONACO_BASE_PATH}/loader.js`;
const MONACO_LOAD_TIMEOUT_MS = 12000;
const MONACO_RETRY_DELAY_MS = 1200;
const MONACO_MAX_AUTOMATIC_RETRIES = 1;
const EDITOR_DEFAULT_FONT_SIZE = 13;
const EDITOR_MIN_FONT_SIZE = 10;
const EDITOR_MAX_FONT_SIZE = 24;
let EDITOR_CONTENT_LEFT = 68;
function updateEditorContentLeft() {
  EDITOR_CONTENT_LEFT = window.innerWidth <= 768 ? 44 : 68;
}
updateEditorContentLeft();
window.addEventListener('resize', updateEditorContentLeft);
const HISTORY_DEBOUNCE_MS = 250;
const MAX_TOASTS = 3;
const PROJECT_PREVIEW_PREFIX = '__html_viewer_project__';
const PROJECT_PREVIEW_SW_VERSION = '20260618-2';
const PROJECT_PREVIEW_SW_URL = `preview-sw.js?v=${PROJECT_PREVIEW_SW_VERSION}`;
const PROJECT_PREVIEW_SW_READY_TIMEOUT_MS = 1800;
const PROJECT_PREVIEW_DEBOUNCE_MIN_MS = 90;
const PROJECT_PREVIEW_DEBOUNCE_MAX_MS = 650;
const EMPTY_PROJECT_PREVIEW_MESSAGE = currentLocale === 'es' ? 'No hay archivos en el proyecto' : 'There are no files in the project';

const fallbackTextarea = document.getElementById('fallback-textarea');
const fallbackLineNumbers = document.getElementById('fallback-line-numbers');
const fallbackCurrentLine = document.getElementById('fallback-current-line');
const filenameInput = document.getElementById('editor-filename');
const previewIframe = document.getElementById('preview-iframe');
const editorPlaceholder = document.getElementById('editor-placeholder');

// Toast Notification Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const activeToasts = container.querySelectorAll('.toast:not(.hide)');

  if (activeToasts.length >= MAX_TOASTS) {
    const oldest = activeToasts[0];
    oldest.classList.add('hide');
    setTimeout(() => {
      oldest.remove();
    }, 300);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', iconName);
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);

  container.appendChild(toast);
  if (window.lucide) {
    lucide.createIcons();
  }

  // Hide and remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hide');
      setTimeout(() => {
        toast.remove();
      }, 350);
    }
  }, 3000);
}

// App State
let editor;
let isResizing = false;
let previewFrameRequest = 0;
let previewRenderId = 0;
let lastPreviewCode = '';
let renderingTimeoutId = null;
let monacoLoaded = false;
let editorFontSize = EDITOR_DEFAULT_FONT_SIZE;
let projectPreviewSessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
let projectPreviewServiceWorkerPromise = null;
let projectPreviewServiceWorker = null;
let projectPreviewVersion = 0;
let projectPreviewLastUrl = '';
let projectPreviewNeedsFullSync = true;
let projectPreviewKnownPaths = new Set();
let projectPreviewDirtyPaths = new Set();
let projectPreviewCurrentPath = '';
let projectPreviewMissingPath = '';
let projectPreviewSiteRoot = '';
let previewShouldRestoreEditorFocus = false;
let previewAllowFocusOnNextRender = false;
let previewBlockFocusForCurrentRender = false;
let projectPreviewLastBlockFocus = null;
let previewHomeNavigationPending = false;
let previewIsAwayFromHome = false;

// Unified / Separated mode state variables
let editorMode = 'unified'; // 'unified' or 'split'

// Monaco Models
let unifiedModel;
const fileModels = {}; // fileId -> monaco.editor.ITextModel

const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'map', 'webmanifest', 'md', 'txt', 'xml', 'svg'
]);
const IMAGE_EXTENSIONS = new Set(['png', 'apng', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'avif', 'bmp']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);
const FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);

let fileIdCounter = 4;
let nextFileOrder = 1;
let activeAssetPreviewUrl = '';
let activeImageZoomController = null;
let internalDragState = null;
let activeExplorerDropElement = null;
let pendingAssetTargetPath = '';
let lucideRenderFrame = 0;
let pendingHtmlOpenClick = null;


function scheduleLucideIcons() {
  if (!window.lucide || lucideRenderFrame) return;
  lucideRenderFrame = requestAnimationFrame(() => {
    lucideRenderFrame = 0;
    if (window.lucide) {
      lucide.createIcons();
    }
  });
}
let activeFileId = '1';
let openFileIds = ['1', '2', '3'];
let isExplorerCollapsed = false;
requestAnimationFrame(() => {
  isExplorerCollapsed = window.innerWidth <= 768;
});
let selectedEntryFileId = '1';
let cameFromSplitMode = false;

// Global history state for Undo/Redo
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;
let isRestoringHistory = false;
let typingSessionActive = false;
let typingDebounceTimeout = null;

