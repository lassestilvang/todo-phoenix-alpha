import { create } from 'zustand';

export type Role = 'admin' | 'manager' | 'user' | 'guest';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
}

export interface RolePermission {
  role: Role;
  permissions: Permission[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  mfaEnabled: boolean;
  lastLogin?: number;
}

export interface RBACState {
  users: Map<string, User>;
  rolePermissions: Map<Role, Permission[]>;
  activeSessions: Map<string, { userId: string; token: string; expires: number }>;
}

export const useRBAC = create<RBACState>((set, get) => ({
  users: new Map(),
  rolePermissions: new Map([
    ['admin', [
      { resource: '*', action: 'create' },
      { resource: '*', action: 'read' },
      { resource: '*', action: 'update' },
      { resource: '*', action: 'delete' },
      { resource: '*', action: 'execute' }
    ]],
    ['manager', [
      { resource: 'task', action: 'create' },
      { resource: 'task', action: 'read' },
      { resource: 'task', action: 'update' },
      { resource: 'project', action: 'read' },
      { resource: 'project', action: 'update' },
      { resource: 'user', action: 'read' },
      { resource: 'team', action: 'read' }
    ]],
    ['user', [
      { resource: 'task', action: 'create' },
      { resource: 'task', action: 'read' },
      { resource: 'task', action: 'update' },
      { resource: 'time_entry', action: 'create' },
      { resource: 'time_entry', action: 'read' },
      { resource: 'time_entry', action: 'update' }
    ]],
    ['guest', [
      { resource: 'task', action: 'read' },
      { resource: 'project', action: 'read' },
      { resource: 'time_entry', action: 'read' }
    ]]
  ]),
  activeSessions: new Map(),

  // User management
  createUser: (userData: Omit<User, 'id'>) => {
    const id = crypto.randomUUID();
    const user: User = { ...userData, id };
    set(state => {
      const users = new Map(state.users);
      users.set(id, user);
      return { users };
    });
    return id;
  },

  assignRole: (userId: string, role: Role) => {
    set(state => {
      const users = new Map(state.users);
      const user = users.get(userId);
      if (user) {
        users.set(userId, { ...user, roles: [...user.roles, role] });
      }
      return { users };
    });
  },

  // Permission checking
  hasPermission: (userId: string, resource: string, action: Permission['action']): boolean => {
    const state = get();
    const user = state.users.get(userId);
    if (!user) return false;

    // Check if user has any role that grants the permission
    for (const role of user.roles) {
      const permissions = state.rolePermissions.get(role) || [];
      for (const permission of permissions) {
        // Check for wildcard match (*)
        if (permission.resource === '*' && permission.action === action) {
          return true;
        }
        // Check for specific resource match
        if (permission.resource === resource && permission.action === action) {
          return true;
        }
      }
    }
    return false;
  },

  // Session management
  login: (userId: string, password: string): boolean => {
    const user = get().users.get(userId);
    if (!user) return false;

    // TODO: Implement password verification
    // For now, simple mock authentication
    const token = crypto.randomUUID();
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    set(state => {
      const sessions = new Map(state.activeSessions);
      sessions.set(token, { userId, token, expires });
      return { activeSessions: sessions };
    });

    return true;
  },

  validateToken: (token: string): User | null => {
    const state = get();
    const session = state.activeSessions.get(token);
    if (!session || session.expires < Date.now()) {
      if (session) {
        state.activeSessions.delete(token);
      }
      return null;
    }

    const user = state.users.get(session.userId);
    if (user) {
      // Update last login
      set(state => {
        const users = new Map(state.users);
        users.set(session.userId, { ...user, lastLogin: Date.now() });
        return { users };
      });
    }

    return user || null;
  },

  logout: (token: string): void => {
    set(state => {
      const sessions = new Map(state.activeSessions);
      sessions.delete(token);
      return { activeSessions: sessions };
    });
  }
}));