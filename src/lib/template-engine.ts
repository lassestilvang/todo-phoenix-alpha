import { TaskFormData } from './types';

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'email' | 'url';
  label?: string;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: { label: string; value: any }[];
  };
  description?: string;
}

export interface TemplateSection {
  id: string;
  title: string;
  fields: TemplateVariable[];
  condition?: {
    field: string;
    operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
    value: any;
  };
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface TaskTemplate {
  id?: number;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  version?: number;
  // Template structure
  sections: TemplateSection[];
  // What this template generates
  templateTask: Partial<TaskFormData>;
  // Global variables that apply to all sections
  globalVariables?: TemplateVariable[];
  // Conditional logic across sections
  crossSectionConditions?: {
    sectionId: string;
    dependsOn?: {
      field: string;
      operator: string;
      value: any;
    }[];
    action?: 'show' | 'hide' | 'enable' | 'disable';
  }[];
}

export interface TemplateResult {
  task: TaskFormData;
  variables: Record<string, any>;
  substitutions: {
    applied: string[];
    failed: string[];
  };
}

export interface TemplateGallery {
  id: string;
  name: string;
  description?: string;
  templates: TaskTemplate[];
  tags?: string[];
  author?: string;
  rating?: number;
  downloads?: number;
}

/**
 * Evaluate a template condition
 */
function evaluateCondition(
  condition: TemplateSection['condition'],
  variables: Record<string, any>
): boolean {
  if (!condition) return true;

  const fieldValue = variables[condition.field];

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condition.value);
    case 'not-equals':
      return String(fieldValue) !== String(condition.value);
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'greater-than':
      return typeof fieldValue === 'number' && fieldValue > condition.value;
    case 'less-than':
      return typeof fieldValue === 'number' && fieldValue < condition.value;
    default:
      return true;
  }
}

/**
 * Substitute variables in a string value
 */
function substituteVariable(
  value: any,
  variables: Record<string, any>,
  globalVariables: TemplateVariable[] = []
): any {
  if (typeof value !== 'string') return value;

  // Check for {{variableName}} pattern
  return value.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    // First check local variables
    if (variableName in variables) {
      return variables[variableName];
    }

    // Then check global variables
    const globalVar = globalVariables?.find(v => v.name === variableName);
    if (globalVar && globalVar.defaultValue !== undefined) {
      return globalVar.defaultValue;
    }

    // Return the placeholder if not found
    return match;
  });
}

/**
 * Process a template variable with its type-specific handling
 */
function processVariable(
  variable: TemplateVariable,
  value: any,
  variables: Record<string, any>,
  globalVariables: TemplateVariable[]
): any {
  // First, try substitution
  let result = substituteVariable(value, variables, globalVariables);

  // Type-specific processing
  switch (variable.type) {
    case 'date': {
      if (typeof result === 'string' && result) {
        const date = new Date(result);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return result;
    }

    case 'number': {
      if (typeof result === 'string') {
        const num = Number(result);
        if (!isNaN(num)) {
          return variable.validation?.min !== undefined && num < variable.validation.min
            ? variable.validation.min
            : variable.validation?.max !== undefined && num > variable.validation.max
              ? variable.validation.max
              : num;
        }
      }
      return variable.validation?.defaultValue ?? result ?? 0;
    }

    case 'select': {
      if (typeof result === 'string' && variable.validation?.options) {
        const selectedOption = variable.validation.options.find(
          (opt: { label: string }) => opt.label === result
        );
        return selectedOption?.value ?? result;
      }
      return result;
    }

    case 'multiselect': {
      if (typeof result === 'string' && variable.validation?.options) {
        const selectedValues = result.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        return selectedValues.filter((v: string) =>
          variable.validation.options!.some((opt: { value: any }) => String(opt.value) === String(v))
        );
      }
      return result;
    }

    case 'boolean': {
      if (typeof result === 'string') {
        return ['true', '1', 'yes', 'y'].includes(result.toLowerCase());
      }
      return !!result;
    }

    case 'email': {
      if (typeof result === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(result)) {
          return result;
        }
      }
      return variable.validation?.defaultValue ?? result;
    }

    case 'url': {
      if (typeof result === 'string') {
        const urlRegex = /^https?:\/\/.+$/i;
        if (urlRegex.test(result)) {
          return result;
        }
      }
      return variable.validation?.defaultValue ?? result;
    }

    default:
      return result;
  }
}

/**
 * Apply a template to generate a task form data object
 */
export function applyTemplate(
  template: TaskTemplate,
  userVariables: Record<string, any> = {}
): TemplateResult {
  const variables: Record<string, any> = { ...userVariables };
  const applied: string[] = [];
  const failed: string[] = [];

  // Start with global variables
  const globalVariables = template.globalVariables || [];

  // Process each section
  const processedSections: TemplateSection[] = [];

  for (const section of template.sections) {
    // Check if section should be shown based on conditions
    if (section.condition) {
      const conditionMet = evaluateCondition(section.condition, variables);
      if (!conditionMet) {
        // Section is hidden, skip processing
        processedSections.push({
          ...section,
          condition: { ...section.condition, hidden: true }
        });
        continue;
      }
    }

    const processedFields: TemplateVariable[] = [];

    for (const field of section.fields) {
      // Get the variable value from user input
      const rawValue = userVariables[field.name];

      // Process the variable with type-specific handling
      const processedValue = processVariable(field, rawValue, variables, globalVariables);

      // Mark the variable as applied
      if (rawValue !== undefined && rawValue !== null) {
        applied.push(field.name);
      }

      processedFields.push({
        ...field,
        value: processedValue,
        wasSubstituted: rawValue !== undefined && rawValue !== null
      });
    }

    processedSections.push({
      ...section,
      fields: processedFields
    });
  }

  // Build the task form data from template fields
  const taskData: TaskFormData = {};

  // Process all fields across sections
  for (const section of processedSections) {
    for (const field of section.fields) {
      if (field.value !== undefined && field.value !== null) {
        // Skip fields that are conditionally hidden
        const shouldHide = section.condition
          ? evaluateCondition(section.condition, variables) === false
          : false;

        if (!shouldHide) {
          // Map variable name to task form data property
          const formFieldName = field.name.replace(/_/g, '');
          // Capitalize first letter for form data mapping
          const mappedName =
            formFieldName.charAt(0).toUpperCase() + formFieldName.slice(1);
          // Handle specific mappings
          let fieldName: keyof TaskFormData;
          switch (mappedName) {
            case 'Name':
              fieldName = 'name';
              break;
            case 'Description':
              fieldName = 'description';
              break;
            case 'Date':
              fieldName = 'date';
              break;
            case 'Deadline':
              fieldName = 'deadline';
              break;
            case 'EstimateMinutes':
            case 'Estimate':
              fieldName = 'estimate_minutes';
              break;
            case 'Priority':
              fieldName = 'priority';
              break;
            case 'IsRecurring':
            case 'Recurring':
              fieldName = 'is_recurring';
              break;
            case 'RecurringPattern':
              fieldName = 'recurring_pattern';
              break;
            case 'RecurringCustomValue':
            case 'CustomValue':
              fieldName = 'recurring_custom_value';
              break;
            case 'ListId':
            case 'List':
              fieldName = 'list_id';
              break;
            default:
              fieldName = mappedName.toLowerCase() as keyof TaskFormData;
          }
          // Only set if it's a valid TaskFormData key
          if (fieldName in taskData) {
            taskData[fieldName] = fieldName === 'estimate_minutes' || fieldName === 'priority'
              ? String(fieldName === 'estimate_minutes' ? fieldName : fieldName)
              : fieldName === 'is_recurring'
                ? String(fieldName === 'is_recurring' ? fieldName : fieldName === 'recurring_pattern' ? fieldName : fieldName)
                : (taskData[fieldName] as any) = fieldName === 'estimate_minutes'
                  ? Number(field.value)
                  : (taskData[fieldName] as any) = field.value;
          }
        }
      }
    }
  }

  // Override with any explicit global variables that weren't in sections
  for (const globalVar of globalVariables) {
    if (!(globalVar.name in variables)) {
      variables[globalVar.name] = globalVar.defaultValue;
    }
  }

  return {
    task: taskData,
    variables,
    substitutions: { applied, failed }
  };
}

/**
 * Generate default templates for common task types
 */
export function generateDefaultTemplates(): TaskTemplate[] {
  return [
    // Work Task Template
    {
      name: 'Work Task',
      description: 'Standard template for work-related tasks',
      category: 'work',
      tags: ['work', 'business'],
      isPublic: true,
      sections: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          fields: [
            { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
            { name: 'taskDescription', type: 'textarea', label: 'Description', placeholder: 'Describe the task', validation: { max: 1000 } },
            { name: 'estimateMinutes', type: 'number', label: 'Estimate (minutes)', placeholder: 'Estimated time', validation: { min: 1, max: 480 } }
          ]
        },
        {
          id: 'priority',
          title: 'Priority',
          fields: [
            { name: 'priority', type: 'select', label: 'Priority', options: [{ label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }] }
          ]
        }
      ],
      templateTask: {
        name: '',
        description: '',
        estimate_minutes: 30,
        priority: 'medium'
      }
    },

    // Personal Task Template
    {
      name: 'Personal Task',
      description: 'Template for personal errands and tasks',
      category: 'personal',
      tags: ['personal', 'errand'],
      isPublic: true,
      sections: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          fields: [
            { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
            { name: 'errandType', type: 'select', label: 'Errand Type', options: [{ label: 'Shopping', value: 'shopping' }, { label: 'Appointment', value: 'appointment' }, { label: 'Home Maintenance', value: 'home-maintenance' }] }
          ]
        }
      ],
      templateTask: {
        name: '',
        estimate_minutes: 60
      }
    },

    // Meeting Template
    {
      name: 'Meeting',
      description: 'Template for meeting tasks with agenda and follow-ups',
      category: 'meeting',
      tags: ['meeting', 'agenda'],
      isPublic: true,
      sections: [
        {
          id: 'meeting-details',
          title: 'Meeting Details',
          fields: [
            { name: 'meetingTitle', type: 'text', label: 'Meeting Title', placeholder: 'Meeting title', required: true },
            { name: 'meetingDate', type: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
            { name: 'meetingDuration', type: 'number', label: 'Duration (minutes)', placeholder: 'e.g., 60', validation: { min: 15, max: 240 } }
          ]
        },
        {
          id: 'agenda',
          title: 'Agenda Items',
          fields: [
            { name: 'agendaItem', type: 'text', label: 'Agenda Item', placeholder: 'Agenda item', required: true }
          ],
          condition: {
            field: 'agendaItem',
            operator: 'contains',
            value: ''
          }
        }
      ],
      templateTask: {
        name: 'Meeting: ',
        estimate_minutes: 60
      }
    }
  ];
}

/**
 * Validate a template variable against its rules
 */
export function validateTemplateVariable(
  variable: TemplateVariable,
  value: any
): { valid: boolean; error?: string } {
  // Check required
  if (variable.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${variable.name} is required` };
  }

  // Skip other validations if not required and value is empty
  if (!variable.required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }

  // Type-specific validation
  switch (variable.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: `${variable.name} must be a valid number` };
      }
      if (variable.validation?.min !== undefined && num < variable.validation.min) {
        return { valid: false, error: `${variable.name} must be at least ${variable.validation.min}` };
      }
      if (variable.validation?.max !== undefined && num > variable.validation.max) {
        return { valid: false, error: `${variable.name} must be at most ${variable.validation.max}` };
      }
      break;
    }

    case 'select': {
      if (variable.validation?.options) {
        const validOptions = variable.validation.options.map((o: { value: any }) => String(o.value));
        if (!validOptions.includes(String(value))) {
          return { valid: false, error: `${variable.name} must be one of: ${validOptions.join(', ')}` };
        }
      }
      break;
    }

    case 'multiselect': {
      if (variable.validation?.options) {
        const validValues = variable.validation.options.map((o: { value: any }) => String(o.value));
        if (Array.isArray(value)) {
          const invalidValues = value.filter((v: any) => !validValues.includes(String(v)));
          if (invalidValues.length > 0) {
            return { valid: false, error: `${variable.name} has invalid values: ${invalidValues.join(', ')}` };
          }
        } else {
          return { valid: false, error: `${variable.name} must be an array` };
        }
      }
      break;
    }

    case 'date': {
      if (value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: `${variable.name} must be a valid date` };
        }
      }
      break;
    }

    case 'email': {
      if (typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { valid: false, error: `${variable.name} must be a valid email address` };
        }
      }
      break;
    }

    case 'url': {
      if (typeof value === 'string') {
        const urlRegex = /^https?:\/\/.+$/i;
        if (!urlRegex.test(value)) {
          return { valid: false, error: `${variable.name} must be a valid URL` };
        }
      }
      break;
    }

    default:
      break;
  }

  return { valid: true };
}

/**
 * Create a template from form data
 */
export function createTemplateFromFormData(
  name: string,
  description: string | null,
  category: string,
  tags: string[],
  sections: TemplateVariable[][]
): TaskTemplate {
  // Flatten sections
  const flatSections: TemplateSection[] = sections.map((fields, sectionIndex) => ({
    id: `section-${sectionIndex}`,
    title: `Section ${sectionIndex + 1}`,
    fields: fields
  }));

  return {
    name,
    description,
    category,
    tags,
    sections: flatSections,
    templateTask: {}
  };
}

export { generateDefaultTemplates };