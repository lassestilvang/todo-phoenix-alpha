export type Priority = 'high' | 'medium' | 'low' | 'none';

export type RecurringPattern = 
  | 'every_day'
  | 'every_week'
  | 'every_weekday'
  | 'every_month'
  | 'every_year'
  | 'custom_n_days'
  | 'custom_n_weeks'
  | 'custom_days_of_month';

export interface List {
  id: number;
  name: string;
  color: string;
  emoji: string;
  icon: string;
  created_at: string;
  updated_at: string;
  is_default: number;
}

export interface Task {
  id: number;
  list_id: number;
  name: string;
  description: string | null;
  date: string | null;
  deadline: string | null;
  estimate_minutes: number;
  actual_minutes: number;
  priority: Priority;
  is_completed: number;
  is_recurring: number;
  recurring_pattern: string | null;
  recurring_custom_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  name: string;
  description: string | null;
  date: string | null;
  deadline: string | null;
  estimate_minutes: number;
  actual_minutes: number;
  priority: Priority;
  is_completed: number;
  is_recurring: number;
  recurring_pattern: string | null;
  recurring_custom_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  emoji: string;
  created_at: string;
  updated_at: string;
}

export interface TaskLabel {
  task_id: number;
  label_id: number;
}

export interface SubtaskLabel {
  subtask_id: number;
  label_id: number;
}

export interface TaskChange {
  id: number;
  task_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface SubtaskChange {
  id: number;
  subtask_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface Reminder {
  id: number;
  task_id: number;
  time: string;
  is_sent: number;
  sent_at: string | null;
}

export interface Attachment {
  id: number;
  task_id: number;
  filename: string;
  file_type: string;
  file_data: string;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number;
}

export interface TaskWithDetails extends Task {
  list: List;
  subtasks: Subtask[];
  labels: Label[];
  reminders: Reminder[];
  attachments: Attachment[];
  time_entries: TimeEntry[];
  changes: TaskChange[];
}

export interface SubtaskWithDetails extends Subtask {
  labels: Label[];
  changes: SubtaskChange[];
}

export type ViewType = 'today' | 'next_7_days' | 'upcoming' | 'all';

export interface TaskFormData {
  name: string;
  description?: string;
  date?: Date;
  deadline?: Date;
  estimate_minutes?: number;
  priority?: Priority;
  is_recurring?: boolean;
  recurring_pattern?: RecurringPattern;
  recurring_custom_value?: string;
  list_id?: number;
  label_ids?: number[];
}

export interface SubtaskFormData {
  name: string;
  description?: string;
  date?: Date;
  deadline?: Date;
  estimate_minutes?: number;
  priority?: Priority;
  is_recurring?: boolean;
  recurring_pattern?: RecurringPattern;
  recurring_custom_value?: string;
  label_ids?: number[];
}
