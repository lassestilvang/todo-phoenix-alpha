import db from './db/schema';
import { Task, TaskWithDetails, User } from './types';

/**
 * Collaboration and communication system for task management
 */

export interface Comment {
  id: string;
  taskId: number;
  userId: string;
  content: string;
  parentId?: string; // For threaded replies
  mentions?: string[]; // User IDs mentioned
  attachments?: string[]; // Attachment IDs
  createdAt: string;
  updatedAt: string;
  reactions?: {
    [userId: string]: string[]; // userId -> emoji array
  };
  deleted: boolean;
}

export interface TaskAssignment {
  taskId: number;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  dueDate?: string;
  notes?: string;
}

export interface Notification {
  id: number;
  userId: string;
  type: 'mention' | 'assignment' | 'comment' | 'status-change' | 'due-soon' | 'system';
  content: string;
  relatedId: number; // task ID or comment ID
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface Activity {
  id: number;
  userId: string;
  action: string;
  entityType: 'task' | 'comment' | 'assignment' | 'list' | 'subtask';
  entityId: number;
  entityName: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface ApprovalWorkflow {
  id: number;
  name: string;
  description: string;
  entityType: 'task' | 'subtask' | 'time-entry';
  requiredApprovals: number;
  approvers: string[]; // User IDs
  isRequired: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedBy: string;
  requestedAt: string;
  dueDate?: string;
  approvals?: {
    userId: string;
    decision: 'approve' | 'reject';
    comment?: string;
    approvedAt: string;
  }[];
}

export interface Presence {
  userId: string;
  lastSeen: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentTaskId?: number;
  currentPage?: string;
}

export const collaborationOperations = {
  // Comments
  createComment: (comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = db.prepare(
      `INSERT INTO comments (
        task_id, user_id, content, parent_id, mentions, attachments
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      comment.taskId,
      comment.userId,
      comment.content,
      comment.parentId || null,
      JSON.stringify(comment.mentions || []),
      JSON.stringify(comment.attachments || [])
    );

    return {
      ...comment,
      id: result.lastInsertRowid as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false
    };
  },

  getComments: (taskId: number, includeDeleted = false) => {
    const query = includeDeleted
      ? 'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM comments WHERE task_id = ? AND deleted = 0 ORDER BY created_at DESC';

    return db.prepare(query).all(taskId) as Comment[];
  },

  getComment: (id: string) => {
    return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment | undefined;
  },

  updateComment: (id: string, updates: Partial<Comment>) => {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(updates.content);
    }
    if (updates.parentId !== undefined) {
      updateFields.push('parent_id = ?');
      updateValues.push(updates.parentId);
    }
    if (updates.mentions !== undefined) {
      updateFields.push('mentions = ?');
      updateValues.push(JSON.stringify(updates.mentions));
    }
    if (updates.attachments !== undefined) {
      updateFields.push('attachments = ?');
      updateValues.push(JSON.stringify(updates.attachments));
    }
    if (updates.deleted !== undefined) {
      updateFields.push('deleted = ?');
      updateValues.push(updates.deleted ? 1 : 0);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);
      db.prepare(`UPDATE comments SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    }

    return collaborationOperations.getComment(id);
  },

  deleteComment: (id: string) => {
    return db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  },

  // Mentions and notifications
  addMention: (commentId: string, userId: string) => {
    const comment = collaborationOperations.getComment(commentId);
    if (!comment) return null;

    const mentions = comment.mentions || [];
    if (!mentions.includes(userId)) {
      mentions.push(userId);

      db.prepare('UPDATE comments SET mentions = ? WHERE id = ?').run(
        JSON.stringify(mentions),
        commentId
      );

      // Create notification for mentioned user
      if (comment.userId !== userId) {
        createNotification({
          userId,
          type: 'mention',
          content: `mentioned you in comment on task #${comment.taskId}`,,
          relatedId: comment.taskId,
          actionUrl: `/tasks/${comment.taskId}?comment=${commentId}`
        });
      }
    }

    return comment;
  },

  // Notifications
  createNotification: (notification: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) => {
    const result = db.prepare(
      `INSERT INTO notifications (
        user_id, type, content, related_id, action_url
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(
      notification.userId,
      notification.type,
      notification.content,
      notification.relatedId,
      notification.actionUrl || null
    );

    return {
      ...notification,
      id: result.lastInsertRowid as number,
      isRead: false,
      createdAt: new Date().toISOString()
    };
  },

  getNotifications: (userId: string, includeRead = false) => {
    const query = includeRead
      ? 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC';

    return db.prepare(query).all(userId) as Notification[];
  },

  markNotificationRead: (id: number) => {
    return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  },

  markAllNotificationsRead: (userId: string) => {
    return db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  },

  // Activity feed
  createActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    const result = db.prepare(
      `INSERT INTO activities (
        user_id, action, entity_type, entity_id, entity_name, changes, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      activity.userId,
      activity.action,
      activity.entityType,
      activity.entityId,
      activity.entityName,
      JSON.stringify(activity.changes || []),
      JSON.stringify(activity.metadata || {})
    );

    return {
      ...activity,
      id: result.lastInsertRowid as number,
      createdAt: new Date().toISOString()
    };
  },

  getActivities: (userId?: string, limit = 50) => {
    const query = userId
      ? 'SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM activities ORDER BY created_at DESC LIMIT ?';

    return db.prepare(query).all(userId, limit) as Activity[];
  },

  // Task assignments
  assignTask: (taskId: number, assignedTo: string, assignedBy: string, notes?: string) => {
    const result = db.prepare(
      `INSERT INTO task_assignments (
        task_id, assigned_to, assigned_by, notes
      ) VALUES (?, ?, ?, ?)`
    ).run(
      taskId,
      assignedTo,
      assignedBy,
      notes || null
    );

    const assignment: TaskAssignment = {
      taskId,
      assignedTo,
      assignedBy,
      assignedAt: new Date().toISOString(),
      notes,
      dueDate: undefined
    };

    // Create notification for assigned user
    createNotification({
      userId: assignedTo,
      type: 'assignment',
      content: `You have been assigned to task #${taskId}`,,
      relatedId: taskId,
      actionUrl: `/tasks/${taskId}`
    });

    // Create activity
    createActivity({
      userId: assignedBy,
      action: 'assign_task',
      entityType: 'task',
      entityId: taskId,
      entityName: `Task #${taskId}`,
      metadata: { assignedTo, notes }
    });

    return assignment;
  },

  getTaskAssignments: (taskId: number) => {
    return db.prepare('SELECT * FROM task_assignments WHERE task_id = ?').all(taskId) as TaskAssignment[];
  },

  // Approval workflows
  createApprovalWorkflow: (workflow: Omit<ApprovalWorkflow, 'id' | 'status' | 'requestedAt'>) => {
    const result = db.prepare(
      `INSERT INTO approval_workflows (
        name, description, entity_type, required_approvals, approvers, is_required,
        requested_by, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      workflow.name,
      workflow.description,
      workflow.entityType,
      workflow.requiredApprovals,
      JSON.stringify(workflow.approvers),
      workflow.isRequired ? 1 : 0,
      workflow.requestedBy,
      workflow.dueDate || null
    );

    return {
      ...workflow,
      id: result.lastInsertRowid as number,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvals: []
    };
  },

  getPendingApprovals: (userId: string) => {
    return db.prepare(
      `SELECT * FROM approval_workflows
       WHERE status = 'pending' AND ? IN (approvers) ORDER BY due_date ASC`
    ).all(userId) as ApprovalWorkflow[];
  },

  submitApproval: (workflowId: number, userId: string, decision: 'approve' | 'reject', comment?: string) => {
    const workflow = db.prepare('SELECT * FROM approval_workflows WHERE id = ?').get(workflowId) as ApprovalWorkflow;
    if (!workflow) throw new Error('Approval workflow not found');

    const approvals = workflow.approvals || [];
    approvals.push({
      userId,
      decision,
      comment,
      approvedAt: new Date().toISOString()
    });

    // Check if all required approvals are in
    const approvedCount = approvals.filter(a => a.decision === 'approve').length;
    let newStatus: 'pending' | 'approved' | 'rejected' = 'pending';

    if (approvedCount >= workflow.requiredApprovals) {
      newStatus = 'approved';
    } else if (approvals.some(a => a.decision === 'reject')) {
      newStatus = 'rejected';
    }

    db.prepare(
      `UPDATE approval_workflows
       SET approvals = ?, status = ?
       WHERE id = ?`
    ).run(JSON.stringify(approvals), newStatus, workflowId);

    // Create notification for workflow requester
    createNotification({
      userId: workflow.requestedBy,
      type: 'status-change',
      content: `Approval workflow "${workflow.name}" ${decision}`,,
      relatedId: workflowId,
      actionUrl: `/approvals/${workflowId}`
    });

    return { ...workflow, approvals, status: newStatus };
  },

  // Presence and online status
  updatePresence: (presence: Presence) => {
    const result = db.prepare(
      `INSERT OR REPLACE INTO user_presence (
        user_id, status, current_task_id, current_page, last_seen
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(
      presence.userId,
      presence.status,
      presence.currentTaskId || null,
      presence.currentPage || null,
      presence.lastSeen
    );

    return presence;
  },

  getUserPresence: (userId: string) => {
    return db.prepare('SELECT * FROM user_presence WHERE user_id = ?').get(userId) as Presence | undefined;
  },

  getAllUsersPresence: () => {
    return db.prepare('SELECT * FROM user_presence').all() as Presence[];
  },

  cleanupInactivePresence: (thresholdMinutes = 10) => {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
    return db.prepare('DELETE FROM user_presence WHERE last_seen < ?').run(threshold);
  }
};

// Initialize database tables for collaboration features
const initCollaborationDatabase = () => {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);

      // Comments table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          task_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          parent_id TEXT,
          mentions TEXT DEFAULT '[]',
          attachments TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted INTEGER DEFAULT 0,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`
      );

      // Notifications table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('mention', 'assignment', 'comment', 'status-change', 'due-soon', 'system')),
          content TEXT NOT NULL,
          related_id INTEGER,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          action_url TEXT
        )`
      );

      // Activity log table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'comment', 'assignment', 'list', 'subtask')),
          entity_id INTEGER NOT NULL,
          entity_name TEXT NOT NULL,
          changes TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT DEFAULT '{}'
        )`
      );

      // Task assignments table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS task_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          assigned_to TEXT NOT NULL,
          assigned_by TEXT NOT NULL,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME,
          notes TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`
      );

      // Approval workflows table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS approval_workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'subtask', 'time-entry')),
          required_approvals INTEGER NOT NULL,
          approvers TEXT NOT NULL, -- JSON array
          is_required INTEGER DEFAULT 1,
          requested_by TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
          requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME,
          approvals TEXT DEFAULT '[]', -- JSON array of approval objects
          FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE
        )`
      );

      // User presence table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS user_presence (
          user_id TEXT PRIMARY KEY,
          status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'away', 'busy', 'offline')),
          current_task_id INTEGER,
          current_page TEXT,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL
        )`
      );

      // Create indexes
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_assignments_task_id ON task_assignments(task_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_workflows(status)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status)');

      console.log('Collaboration database tables created successfully');
    } catch (error) {
      console.warn('Failed to initialize collaboration database:', error);
    }
  }
};

// Initialize collaboration database
initCollaborationDatabase();

export { collaborationOperations };