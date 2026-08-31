"use client"

import { useEffect } from 'react';

/**
 * Accessibility Updater
 * Adds ARIA labels and attributes to key components for WCAG 2.1 AA compliance
 */
export function AccessibilityUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const enhanceComponents = () => {
      // Find all interactive elements and enhance them with ARIA labels
      const taskDialog = document.querySelector('[data-dialog="task-form"]');
      if (taskDialog) {
        // Add ARIA labels to the dialog
        taskDialog.setAttribute('role', 'dialog');
        taskDialog.setAttribute('aria-modal', 'true');
        taskDialog.setAttribute('aria-labelledby', 'task-form-title');
        taskDialog.setAttribute('aria-describedby', 'task-form-description');

        // Add ARIA labels to form fields
        const inputs = taskDialog.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
          const label = input.getAttribute('aria-label') || input.getAttribute('title');
          if (label) {
            input.setAttribute('aria-label', label);
          }

          // Add error message announcements
          if (input.hasAttribute('aria-invalid')) {
            const errorId = input.getAttribute('aria-errormessage');
            if (errorId) {
              input.setAttribute('aria-describedby', `${errorId} ${input.getAttribute('aria-describedby') || ''}`.trim());
            }
          }
        });
      }

      // Enhance task items
      const taskItems = document.querySelectorAll('[data-task-item]');
      taskItems.forEach(item => {
        const taskTitle = item.querySelector('[data-task-title]');
        const taskStatus = item.getAttribute('data-task-status');

        if (taskTitle) {
          item.setAttribute('role', 'listitem');
          item.setAttribute('aria-label', `Task: ${taskTitle.textContent}, Status: ${taskStatus}`);

          // Add keyboard navigation support
          item.setAttribute('tabindex', '0');
          item.classList.add('task-interactive');
        }
      });

      // Enhance calendar components
      const calendars = document.querySelectorAll('[data-radix-calendar]');
      calendars.forEach(calendar => {
        calendar.setAttribute('role', 'grid');
        calendar.setAttribute('aria-label', 'Calendar');
        calendar.setAttribute('aria-readonly', 'false');
      });

      // Enhance dropdown menus
      const selects = document.querySelectorAll('[data-radix-select]');
      selects.forEach(select => {
        const label = select.getAttribute('aria-label') || select.getAttribute('title');
        if (label) {
          select.setAttribute('aria-label', label);
        }
      });

      // Enhance sliders
      const sliders = document.querySelectorAll('[data-radix-slider]');
      sliders.forEach(slider => {
        const label = slider.getAttribute('aria-label') || slider.getAttribute('title');
        if (label) {
          slider.setAttribute('aria-label', label);
        }

        // Add value announcements
        const valueDisplay = slider.querySelector('[data-slider-value]');
        if (valueDisplay) {
          valueDisplay.setAttribute('aria-live', 'polite');
          valueDisplay.setAttribute('aria-atomic', 'true');
        }
      });

      // Enhance file input buttons
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach(input => {
        const label = input.getAttribute('aria-label') || 'Choose file';
        input.setAttribute('aria-label', label);

        // Create file input wrapper for better accessibility
        const parent = input.parentElement;
        if (parent && !parent.classList.contains('file-input-enhanced')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'file-input-enhanced';
          wrapper.appendChild(input.cloneNode(true));

          const visibleButton = parent.querySelector('button[type="button"]');
          if (visibleButton) {
            wrapper.appendChild(visibleButton);
            parent.replaceChild(wrapper, parent.firstChild || visibleButton);
          }
        }
      });
    };

    // Run enhancement on mount and window resize
    enhanceComponents();
    window.addEventListener('resize', enhanceComponents);

    // Re-run on DOM changes (using MutationObserver)
    const observer = new MutationObserver(() => {
      setTimeout(enhanceComponents, 100); // Delay for DOM to settle
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener('resize', enhanceComponents);
      observer.disconnect();
    };
  }, []);

  return null; // This component doesn't render anything
}