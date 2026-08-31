/**
 * Internationalization (i18n) foundation for Todo Phoenix Alpha
 *
 * Provides:
 * - Language detection from browser/user settings
 * - Translation file loading
 * - Date/number formatting per locale
 * - Translation key lookup with fallback
 */

type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

interface Translations {
  [key: string]: string | { [key: string]: string };
}

interface TranslationFiles {
  [lang: string]: Translations;
}

// Placeholder translations - base English with initial Spanish translation
const baseTranslations: TranslationFiles = {
  en: {
    // Common UI strings
    'app.title': 'Todo Phoenix Alpha',
    'app.loading': 'Loading...',
    'app.error': 'Something went wrong',
    'app.success': 'Success!',
    'app.cancel': 'Cancel',
    'app.save': 'Save',
    'app.delete': 'Delete',
    'app.edit': 'Edit',
    'app.create': 'Create',
    'app.update': 'Update',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.tasks': 'Tasks',
    'nav.projects': 'Projects',
    'nav.analytics': 'Analytics',
    'nav.collaboration': 'Collaboration',
    'nav.settings': 'Settings',

    // Task strings
    'task.new': 'New Task',
    'task.title': 'Task Title',
    'task.description': 'Description',
    'task.priority.high': 'High',
    'task.priority.medium': 'Medium',
    'task.priority.low': 'Low',
    'task.status.pending': 'Pending',
    'task.status.in_progress': 'In Progress',
    'task.status.completed': 'Completed',
    'task.status.cancelled': 'Cancelled',

    // Actions
    'action.create_task': 'Create Task',
    'action.complete_task': 'Mark Complete',
    'action.cancel_task': 'Cancel',
    'action.delete_task': 'Delete Task',
    'action.add_subtask': 'Add Subtask',
    'action.set_deadline': 'Set Deadline',

    // Time
    'time.today': 'Today',
    'time.tomorrow': 'Tomorrow',
    'time.yesterday': 'Yesterday',
    'time.minutes': 'minutes',
    'time.hours': 'hours',
    'time.days': 'days',

    // Dates
    'date.january': 'January',
    'date.february': 'February',
    'date.march': 'March',
    'date.april': 'April',
    'date.may': 'May',
    'date.june': 'June',
    'date.july': 'July',
    'date.august': 'August',
    'date.september': 'September',
    'date.october': 'October',
    'date.november': 'November',
    'date.december': 'December',

    // Notifications
    'notification.deadline_reminder': 'Task deadline approaching',
    'notification.task_completed': 'Task completed',
    'notification.task_cancelled': 'Task cancelled',
    'notification.error': 'Error occurred',
  },

  // Spanish translations
  es: {
    'app.title': 'Todo Phoenix Alpha',
    'app.loading': 'Cargando...',
    'app.error': 'Algo salió mal',
    'app.success': '¡Éxito!',
    'app.cancel': 'Cancelar',
    'app.save': 'Guardar',
    'app.delete': 'Eliminar',
    'app.edit': 'Editar',
    'app.create': 'Crear',
    'app.update': 'Actualizar',

    'nav.dashboard': 'Panel',
    'nav.tasks': 'Tareas',
    'nav.projects': 'Proyectos',
    'nav.analytics': 'Analíticas',
    'nav.collaboration': 'Colaboración',
    'nav.settings': 'Configuración',

    'task.new': 'Nueva Tarea',
    'task.title': 'Título de la Tarea',
    'task.description': 'Descripción',
    'task.priority.high': 'Alta',
    'task.priority.medium': 'Media',
    'task.priority.low': 'Baja',
    'task.status.pending': 'Pendiente',
    'task.status.in_progress': 'En Progreso',
    'task.status.completed': 'Completada',
    'task.status.cancelled': 'Cancelada',

    'action.create_task': 'Crear Tarea',
    'action.complete_task': 'Marcar Completa',
    'action.cancel_task': 'Cancelar',
    'action.delete_task': 'Eliminar Tarea',
    'action.add_subtask': 'Agregar Subtarea',
    'action.set_deadline': 'Establecer Fecha Límite',

    'time.today': 'Hoy',
    'time.tomorrow': 'Mañana',
    'time.yesterday': 'Ayer',
    'time.minutes': 'minutos',
    'time.hours': 'horas',
    'time.days': 'días',

    'date.january': 'Enero',
    'date.february': 'Febrero',
    'date.march': 'Marzo',
    'date.april': 'Abril',
    'date.may': 'Mayo',
    'date.june': 'Junio',
    'date.july': 'Julio',
    'date.august': 'Agosto',
    'date.september': 'Septiembre',
    'date.october': 'Octubre',
    'date.november': 'Noviembre',
    'date.december': 'Diciembre',

    'notification.deadline_reminder': 'La fecha límite de la tarea se acerca',
    'notification.task_completed': 'Tarea completada',
    'notification.task_cancelled': 'Tarea cancelada',
    'notification.error': 'Error',
  },
};

class I18nService {
  private currentLanguage: Language = 'en';
  private translations: TranslationFiles = { ...baseTranslations };

  /**
   * Detect browser language preference
   */
  detectLanguage(): Language {
    if (typeof navigator === 'undefined') return 'en'; // Server-side default

    const browserLang = navigator.language.split('-')[0] as Language;
    const supportedLangs: Language[] = ['en', 'es', 'fr', 'de', 'ja', 'zh'];

    if (supportedLangs.includes(browserLang)) {
      return browserLang;
    }

    return 'en';
  }

  /**
   * Set the current language
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
  }

  /**
   * Get the current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Translate a key with fallback to English
   */
  t(key: string, options?: { count?: number }): string {
    const lang = this.currentLanguage;
    const translations = this.translations[lang] || baseTranslations.en;

    // Try to find the translation
    const value = translations[key];

    if (typeof value === 'string') {
      if (options?.count !== undefined) {
        return value.replace('{count}', String(options.count));
      }
      return value;
    }

    // Key not found, return the key itself as fallback
    return key;
  }

  /**
   * Format a date according to locale
   */
  formatDate(date: Date | string, style: 'short' | 'medium' | 'long' = 'medium'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) {
      return dateObj.toISOString();
    }

    try {
      return new Intl.DateTimeFormat(this.currentLanguage, {
        dateStyle: style,
      }).format(dateObj);
    } catch {
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Format a number according to locale
   */
  formatNumber(value: number): string {
    if (typeof Intl === 'undefined' || !Intl.NumberFormat) {
      return String(value);
    }

    try {
      return new Intl.NumberFormat(this.currentLanguage).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(value: number, currency: string = 'USD'): string {
    if (typeof Intl === 'undefined' || !Intl.NumberFormat) {
      return `${currency} ${value}`;
    }

    try {
      return new Intl.NumberFormat(this.currentLanguage, {
        style: 'currency',
        currency,
      }).format(value);
    } catch {
      return `${currency} ${value}`;
    }
  }

  /**
   * Load additional translations
   */
  loadTranslations(lang: Language, translations: Translations): void {
    if (!this.translations[lang]) {
      this.translations[lang] = {};
    }
    Object.assign(this.translations[lang], translations);
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): Language[] {
    return Object.keys(baseTranslations) as Language[];
  }
}

export const i18n = new I18nService();

// Re-export types
export type { Language, Translations };