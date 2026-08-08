export interface Task {
  id: string;
  description: string;
  required_capabilities: string[];
  priority: number;
  dependencies: string[];
  created_by: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  created_at: number;
  estimate_minutes?: number;
  deadline?: Date | string;
  labels?: string[];
}

export interface Project {
  id: number;
  name: string;
  color: string;
  emoji: string;
  description?: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  children?: Project[];
}

// Project operations interface
export interface ProjectOperations {
  getAll: () => Promise<Project[]>;
  getById: (id: number) => Promise<Project | null>;
  create: (data: Omit<Project, 'id'>) => Promise<Project>;
  update: (id: number, updates: Partial<Omit<Project, 'id'>>) => Promise<Project>;
  delete: (id: number) => Promise<void>;
  getChildren: (id: number) => Promise<Project[]>;
  getHierarchy: () => Promise<Project[]>;
}