import { TaskFormData } from './types';
import { generateTaskSuggestions } from './ai/enhancement';

export interface TemplateVariableValidation {
  min?: number;
  max?: number;
  options?: { label: string; value: string }[];
  defaultValue?: any;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'email' | 'url' | 'textarea';
  label?: string;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
  value?: any;
  wasSubstituted?: boolean;
  timeEstimate?: number;
  priority?: string;
  deadline?: string | Date;
  category?: 'productivity' | 'streak' | 'milestone' | 'learning' | 'consistency' | 'community';
  automatic?: boolean;
  validation?: TemplateVariableValidation;
}

export interface TemplateSection {
  id: string;
  title: string;
  fields: TemplateVariable[];
  condition?: {
    field: string;
    operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
    value: any;
    hidden?: boolean;
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
  const result = substituteVariable(value, variables, globalVariables);

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
        const selectedOption = variable.validation.options!.find(
          (opt: { label: string }) => opt.label === result
        );
        return selectedOption?.value ?? result;
      }
      return result;
    }

    case 'multiselect': {
      if (typeof result === 'string' && variable.validation?.options) {
        const selectedValues = result.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        const options = variable.validation.options!;
        return selectedValues.filter((v: string) =>
          options.some((opt: { value: any }) => String(opt.value) === String(v))
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
  const taskData: Partial<TaskFormData> = {};

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
          // Set the field value with appropriate type coercion
          if (fieldName === 'estimate_minutes') {
            taskData[fieldName] = Number(field.value) as any;
          } else if (fieldName === 'priority') {
            taskData[fieldName] = field.value as any;
          } else if (fieldName === 'is_recurring') {
            taskData[fieldName] = Boolean(field.value) as any;
          } else {
            taskData[fieldName] = field.value as any;
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
    task: taskData as TaskFormData,
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
      tags: ['work', 'business', 'professional'],
      isPublic: true,
      sections: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          fields: [
            { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
            { name: 'taskDescription', type: 'textarea', label: 'Description', placeholder: 'Describe the task', validation: { max: 1000 } },
            { name: 'estimateMinutes', type: 'number', label: 'Estimate (minutes)', defaultValue: 30, validation: { min: 1, max: 480 } }
          ]
        },
        {
          id: 'priority',
          title: 'Priority & Deadline',
          fields: [
            { name: 'priority', type: 'select', label: 'Priority', validation: { options: [{ label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }] } },
            { name: 'deadline', type: 'date', label: 'Deadline (optional)', placeholder: 'YYYY-MM-DD' }
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
      tags: ['personal', 'errand', 'life'],
      isPublic: true,
      sections: [
        {
          id: 'basic-info',
          title: 'Task Details',
          fields: [
            { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
            { name: 'errandType', type: 'select', label: 'Errand Type', validation: { options: [{ label: 'Shopping', value: 'shopping' }, { label: 'Appointment', value: 'appointment' }, { label: 'Home Maintenance', value: 'home-maintenance' }, { label: 'Health', value: 'health' }, { label: 'Family', value: 'family' }] } }
          ]
        },
        {
          id: 'schedule',
          title: 'When',
          fields: [
            { name: 'date', type: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
            { name: 'estimateMinutes', type: 'number', label: 'Time Needed (minutes)', defaultValue: 30, validation: { min: 5, max: 240 } }
          ]
        }
      ],
      templateTask: {
        name: '',
        estimate_minutes: 30
      }
    },

    // Meeting Template
    {
      name: 'Meeting',
      description: 'Template for meeting tasks with agenda and follow-ups',
      category: 'meeting',
      tags: ['meeting', 'agenda', 'collaboration'],
      isPublic: true,
      sections: [
        {
          id: 'meeting-details',
          title: 'Meeting Details',
          fields: [
            { name: 'meetingTitle', type: 'text', label: 'Meeting Title', placeholder: 'Meeting title', required: true },
            { name: 'meetingDate', type: 'date', label: 'Date', placeholder: 'YYYY-MM-DD', defaultValue: new Date().toISOString().split('T')[0] },
            { name: 'meetingDuration', type: 'number', label: 'Duration (minutes)', placeholder: 'e.g., 60', defaultValue: 60, validation: { min: 15, max: 240 } }
          ]
        },
        {
          id: 'agenda',
          title: 'Agenda Items',
          fields: [
            { name: 'agendaItem', type: 'text', label: 'Agenda Item', placeholder: 'Agenda item', required: true }
          ]
        }
      ],
      templateTask: {
        name: 'Meeting: ',
        estimate_minutes: 60
      }
    },

    // Project Task Template
    {
      name: 'Project Task',
      description: 'Comprehensive template for project-based work',
      category: 'work',
      tags: ['project', 'development', 'planning'],
      isPublic: true,
      sections: [
        {
          id: 'project-info',
          title: 'Project Details',
          fields: [
            { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
            { name: 'taskDescription', type: 'textarea', label: 'Description', placeholder: 'Detailed task description', validation: { max: 2000 } },
            { name: 'projectGoal', type: 'textarea', label: 'Project Goal/Objective', placeholder: 'What are we trying to achieve?', validation: { max: 500 } }
          ]
        },
        {
          id: 'technical',
          title: 'Technical Details',
          fields: [
            { name: 'technicalSpec', type: 'textarea', label: 'Technical Specifications', placeholder: 'Technical requirements, specs, etc.', validation: { max: 1000 } },
            { name: 'dependencies', type: 'text', label: 'Dependencies (comma-separated)', placeholder: 'Other tasks this depends on' }
          ]
        },
        {
          id: 'planning',
          title: 'Planning',
          fields: [
            { name: 'estimateMinutes', type: 'number', label: 'Time Estimate (minutes)', defaultValue: 120, validation: { min: 15, max: 1440 } },
            { name: 'deadline', type: 'date', label: 'Deadline' },
            { name: 'priority', type: 'select', label: 'Priority', validation: { options: [{ label: 'Critical', value: 'high' }, { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }] } }
          ]
        }
      ],
      templateTask: {
        name: '',
        description: '',
        estimate_minutes: 120,
        priority: 'medium'
      }
    },

    // Learning Task Template
    {
      name: 'Learning Task',
      description: 'Template for learning new skills or studying',
      category: 'learning',
      tags: ['learning', 'education', 'skill'],
      isPublic: true,
      sections: [
        {
          id: 'learning-info',
          title: 'Learning Details',
          fields: [
            { name: 'taskName', type: 'text', label: 'Topic/Skill Name', placeholder: 'What are you learning?', required: true },
            { name: 'learningSource', type: 'select', label: 'Source Type', validation: { options: [{ label: 'Book', value: 'book' }, { label: 'Course', value: 'course' }, { label: 'Video', value: 'video' }, { label: 'Tutorial', value: 'tutorial' }, { label: 'Experiment', value: 'experiment' }] } }
          ]
        },
        {
          id: 'goals',
          title: 'Learning Goals',
          fields: [
            { name: 'learningOutcome', type: 'textarea', label: 'Expected Outcome', placeholder: 'What will you be able to do?', validation: { max: 500 } }
          ]
        },
        {
          id: 'schedule',
          title: 'Schedule',
          fields: [
            { name: 'estimateMinutes', type: 'number', label: 'Study Time (minutes)', defaultValue: 60, validation: { min: 30, max: 360 } },
            { name: 'deadline', type: 'date', label: 'Completion Date' }
          ]
        }
      ],
      templateTask: {
        name: '',
        estimate_minutes: 60
      }
    },

    // Review Task Template
    {
      name: 'Review Task',
      description: 'Template for reviewing work, code, or content',
      category: 'work',
      tags: ['review', 'quality', 'feedback'],
      isPublic: true,
      sections: [
        {
          id: 'review-info',
          title: 'Review Details',
          fields: [
            { name: 'taskName', type: 'text', label: 'Item to Review', placeholder: 'What are you reviewing?', required: true },
            { name: 'reviewerNotes', type: 'textarea', label: 'Review Notes', placeholder: 'Your observations and feedback', validation: { max: 1000 } }
          ]
        },
        {
          id: 'criteria',
          title: 'Review Criteria',
          fields: [
            { name: 'qualityScore', type: 'number', label: 'Quality Score (1-10)', defaultValue: 5, validation: { min: 1, max: 10 } },
            { name: 'feedbackSummary', type: 'textarea', label: 'Summary', placeholder: 'Overall feedback summary', validation: { max: 200 } }
          ]
        },
        {
          id: 'nextSteps',
          title: 'Next Steps',
          fields: [
            { name: 'actionItems', type: 'text', label: 'Action Items (comma-separated)', placeholder: 'Items that need to be done' }
          ]
        }
      ],
      templateTask: {
        name: '',
        estimate_minutes: 30
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
  description: string,
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

/**
 * NEW: Generate AI-powered smart templates based on user task patterns
 */
export async function generateSmartTemplate(
  taskName: string,
  taskDescription?: string
): Promise<TaskTemplate> {
  // Use AI to suggest a template structure based on the task
  const aiResponse = await generateTaskSuggestions({
    priority: 'medium',
    estimate_minutes: 30,
    date: undefined
  }).catch(() => ({
    priority: 'medium',
    suggestedTimeEstimate: 30,
    suggestedDate: null,
    relatedTasks: [],
    confidence: 50
  }));

  const category = categorizeTask(taskName, taskDescription);

  return {
    name: taskName,
    description: taskDescription || `Auto-generated template for "${taskName}"`,
    category,
    tags: [category, 'smart-template'],
    isPublic: false,
    version: 1,
    sections: [
      {
        id: 'main',
        title: 'Task Details',
        fields: [
          { name: 'taskName', type: 'text', label: 'Task Name', placeholder: 'Enter task name', required: true },
          { name: 'taskDescription', type: 'textarea', label: 'Description', placeholder: 'Enter detailed description' },
          { name: 'estimateMinutes', type: 'number', label: 'Estimate (minutes)', defaultValue: aiResponse.suggestedTimeEstimate, validation: { min: 1, max: 480 } },
          { name: 'priority', type: 'select', label: 'Priority', validation: { options: [{ label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }] } },
          { name: 'deadline', type: 'date', label: 'Deadline (optional)', placeholder: 'YYYY-MM-DD' }
        ]
      }
    ],
    templateTask: {
      name: taskName,
      description: taskDescription || '',
      estimate_minutes: aiResponse.suggestedTimeEstimate,
      priority: aiResponse.priority as any
    }
  };
}

/**
 * Categorize a task based on its name and description
 */
function categorizeTask(name: string, description?: string): string {
  const text = (name + ' ' + (description || '')).toLowerCase();

  const patterns: { [key: string]: RegExp } = {
    'work': /meeting|project|work|client|deadline|report|presentation/i,
    'personal': /personal|family|health|exercise|gym|doctor| appointment/i,
    'learning': /learn|study|read|course|tutorial|education|skill/i,
    'creative': /design|create|write|brainstorm|idea|draft|content/i,
    'admin': /email|reply|organize|files|backup|update|admin/i,
    'maintenance': /fix|repair|maintenance|update|upgrade/i,
  };

  for (const [category, regex] of Object.entries(patterns)) {
    if (regex.test(text)) {
      return category;
    }
  }

  return 'general';
}

/**
 * Get template suggestions based on current context
 */
export async function getTemplateSuggestions(
  context?: string,
  listId?: number
): Promise<TaskTemplate[]> {
  // Start with default templates
  const defaults = generateDefaultTemplates();

  // If we have context, suggest relevant templates
  if (context) {
    const category = categorizeTask(context);
    const matching = defaults.filter(t => t.category === category);
    if (matching.length > 0) {
      return matching;
    }
  }

  // Return all templates if no context
  return defaults;
}

/**
 * Save a template for future use
 */
export async function saveTemplate(
  template: TaskTemplate,
  userId: string = 'default'
): Promise<{ id: number; name: string }> {
  const db = (await import('./db/schema')).default;

  const result = db.prepare(`
    INSERT INTO templates (name, description, list_id, template_data, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    template.name,
    template.description || '',
    template.globalVariables?.[0]?.value || null,
    JSON.stringify(template),
    userId
  );

  return {
    id: Number(result.lastInsertRowid),
    name: template.name
  };
}

/**
 * Load templates for a user
 */
export async function loadTemplates(userId: string = 'default'): Promise<TaskTemplate[]> {
  const db = (await import('./db/schema')).default;

  const rows = db.prepare(`
    SELECT * FROM templates WHERE user_id = ? OR user_id = 'default'
    ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map(row => {
    try {
      const template = JSON.parse(row.template_data);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        category: template.category || 'general',
        ...template
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as TaskTemplate[];
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(
  category: string,
  userId: string = 'default'
): Promise<TaskTemplate[]> {
  const all = await loadTemplates(userId);
  return all.filter(t => t.category === category);
}

/**
 * Clone a template with modifications
 */
export function cloneTemplate(
  template: TaskTemplate,
  modifications: Partial<TaskTemplate> = {}
): TaskTemplate {
  return {
    ...template,
    ...modifications,
    sections: template.sections.map(section => ({
      ...section,
      fields: section.fields.map(field => ({ ...field }))
    }))
  };
}

/**
 * Export a template
 */
export function exportTemplate(template: TaskTemplate): string {
  return JSON.stringify(template, null, 2);
}

/**
 * Import a template
 */
export function importTemplate(templateJson: string): TaskTemplate {
  const parsed = JSON.parse(templateJson);
  return {
    name: parsed.name,
    description: parsed.description,
    category: parsed.category || 'general',
    tags: parsed.tags || [],
    isPublic: parsed.isPublic || false,
    sections: parsed.sections,
    templateTask: parsed.templateTask || {},
    globalVariables: parsed.globalVariables,
    version: parsed.version || 1
  };
}