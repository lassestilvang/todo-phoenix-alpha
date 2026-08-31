import { useEffect, useState } from 'react';
import { i18n, type Language } from '@/lib/i18n';

/**
 * Hook for using internationalization in components
 * Provides t() function for translations and handles language changes
 */
export function useI18n() {
  const [language, setLanguage] = useState<Language>(i18n.getLanguage());

  // Set language on mount and when changed
  useEffect(() => {
    const lang = i18n.getLanguage();
    setLanguage(lang);

    // Listen for language changes from external sources
    // In a real app, this might come from context or redux
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Update language if external change detected
  useEffect(() => {
    const checkLanguage = () => {
      const current = i18n.getLanguage();
      if (current !== language) {
        setLanguage(current);
      }
    };

    // Check every second for language changes (simple polling)
    const interval = setInterval(checkLanguage, 1000);
    return () => clearInterval(interval);
  }, [language]);

  /**
   * Translate a key
   */
  const t = (key: string) => i18n.t(key);

  /**
   * Format date
   */
  const formatDate = (date: Date | string, style: 'short' | 'medium' | 'long' = 'medium') =>
    i18n.formatDate(date, style);

  /**
   * Format number
   */
  const formatNumber = (value: number) => i18n.formatNumber(value);

  /**
   * Format currency
   */
  const formatCurrency = (value: number, currency: string = 'USD') =>
    i18n.formatCurrency(value, currency);

  /**
   * Change language
   */
  const changeLanguage = (lang: Language) => {
    i18n.setLanguage(lang);
    setLanguage(lang);
    // Also update HTML lang attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  };

  return {
    t,
    language,
    changeLanguage,
    formatDate,
    formatNumber,
    formatCurrency,
  };
}