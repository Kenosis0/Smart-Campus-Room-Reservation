/**
 * Form Validation and Confirmation Utilities
 * Provides input validation, confirmation dialogs, and error handling
 */

window.FormValidation = {
  /**
   * Show confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {string} action - Action button text (e.g., "Approve", "Reject")
   * @returns {Promise<boolean>} - True if user clicks action, false if cancel
   */
  confirm: async (title, message, action = 'Confirm') => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      
      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg p-6 max-w-sm mx-auto shadow-lg';
      
      dialog.innerHTML = `
        <h2 class="text-lg font-semibold text-slate-900 mb-2">${escapeHtml(title)}</h2>
        <p class="text-slate-600 mb-6">${escapeHtml(message)}</p>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors" id="confirmCancel">
            Cancel
          </button>
          <button class="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-medium" id="confirmAction">
            ${escapeHtml(action)}
          </button>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      
      dialog.querySelector('#confirmCancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      
      dialog.querySelector('#confirmAction').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });
    });
  },

  /**
   * Validate date is not in the past
   */
  validateFutureDate: (dateStr) => {
    const selected = dayjs(dateStr);
    const today = dayjs().startOf('day');
    
    if (selected.isBefore(today)) {
      return { valid: false, error: 'Cannot book dates in the past' };
    }
    return { valid: true };
  },

  /**
   * Validate time slots are consecutive
   */
  validateConsecutiveSlots: (slotIds, availableSlots) => {
    if (slotIds.length === 0) {
      return { valid: false, error: 'Select at least one time slot' };
    }
    
    if (slotIds.length === 1) {
      return { valid: true };
    }
    
    // Check if slots are consecutive
    const sortedSlots = [...slotIds].sort((a, b) => a - b);
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      if (sortedSlots[i + 1] - sortedSlots[i] !== 1) {
        return { valid: false, error: 'Time slots must be consecutive' };
      }
    }
    
    // Check if all slots are available
    const bookedSlots = availableSlots
      .filter(slot => slot.status === 'CONFIRMED')
      .map(slot => slot.slotId);
    
    for (const slotId of slotIds) {
      if (bookedSlots.includes(slotId)) {
        return { valid: false, error: 'One or more selected slots are already booked' };
      }
    }
    
    return { valid: true };
  },

  /**
   * Validate non-empty text field
   */
  validateRequired: (value, fieldName) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  },

  /**
   * Validate text length
   */
  validateLength: (value, minLength, maxLength, fieldName) => {
    const len = value ? value.trim().length : 0;
    
    if (len < minLength) {
      return { 
        valid: false, 
        error: `${fieldName} must be at least ${minLength} characters` 
      };
    }
    
    if (len > maxLength) {
      return { 
        valid: false, 
        error: `${fieldName} must not exceed ${maxLength} characters` 
      };
    }
    
    return { valid: true };
  },

  /**
   * Validate email format
   */
  validateEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email format' };
    }
    
    return { valid: true };
  },

  /**
   * Show inline validation error
   */
  showFieldError: (field, message) => {
    // Remove existing error
    const existing = field.parentElement.querySelector('.field-error');
    if (existing) existing.remove();
    
    // Add error class to field
    field.classList.add('border-red-500', 'focus:ring-red-500');
    
    // Add error message
    const errorEl = document.createElement('p');
    errorEl.className = 'field-error text-red-500 text-sm mt-1';
    errorEl.textContent = message;
    field.parentElement.appendChild(errorEl);
  },

  /**
   * Clear field error
   */
  clearFieldError: (field) => {
    const error = field.parentElement.querySelector('.field-error');
    if (error) error.remove();
    
    field.classList.remove('border-red-500', 'focus:ring-red-500');
  },

  /**
   * Validate entire form before submission
   */
  validateForm: (formConfig) => {
    /**
     * formConfig: {
     *   fields: {
     *     fieldName: {
     *       element: HTMLElement,
     *       validators: [
     *         { type: 'required', message: 'This is required' },
     *         { type: 'minLength', value: 3, message: 'Min 3 chars' },
     *         { type: 'email', message: 'Invalid email' }
     *       ]
     *     }
     *   }
     * }
     */
    
    const errors = {};
    
    Object.entries(formConfig.fields).forEach(([fieldName, config]) => {
      const value = config.element.value;
      
      for (const validator of config.validators) {
        let result;
        
        switch (validator.type) {
          case 'required':
            result = window.FormValidation.validateRequired(value, validator.label || fieldName);
            break;
          case 'minLength':
            result = { valid: value.length >= validator.value, error: validator.message };
            break;
          case 'maxLength':
            result = { valid: value.length <= validator.value, error: validator.message };
            break;
          case 'email':
            result = window.FormValidation.validateEmail(value);
            break;
          default:
            result = { valid: true };
        }
        
        if (!result.valid) {
          errors[fieldName] = result.error;
          window.FormValidation.showFieldError(config.element, result.error);
          break;
        } else {
          window.FormValidation.clearFieldError(config.element);
        }
      }
    });
    
    return Object.keys(errors).length === 0 ? { valid: true } : { valid: false, errors };
  }
};

/**
 * Helper function for HTML escaping (prevent XSS)
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
