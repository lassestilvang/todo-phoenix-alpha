import db from './schema';

export interface TimeEntry {
  id: number;
  task_id: number;
  started_at: string;
  stopped_at: string | null;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
  rounding: 'none' | '5min' | '15min';
  approved: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approval_by?: number;
  approval_at?: string;
}

export const timeEntryOperations = {
  getAllForTask: (taskId: number): TimeEntry[] => {
    return db.prepare(
      'SELECT * FROM time_entries WHERE task_id = ? ORDER BY started_at DESC'
    ).all(taskId) as TimeEntry[];
  },

  getById: (id: number): TimeEntry | null => {
    const result = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
    return result as TimeEntry | null;
  },

  getActiveEntry: (taskId: number): TimeEntry | null => {
    const result = db.prepare(
      'SELECT * FROM time_entries WHERE task_id = ? AND stopped_at IS NULL ORDER BY started_at DESC LIMIT 1'
    ).get(taskId);
    return result as TimeEntry | null;
  },

  create: (data: {
    taskId: number;
    startedAt: string;
    rounding?: 'none' | '5min' | '15min';
  }): TimeEntry => {
    const rounding = data.rounding || 'none';
    const result = db.prepare(
      'INSERT INTO time_entries (task_id, started_at, rounding, approved) VALUES (?, ?, ?, 0)'
    ).run(data.taskId, data.startedAt, rounding);

    return db.prepare('SELECT * FROM time_entries WHERE id = ?')
      .get(result.lastInsertRowid as number) as TimeEntry;
  },

  stop: (taskId: number): TimeEntry | null => {
    const active = db.prepare(
      'SELECT * FROM time_entries WHERE task_id = ? AND stopped_at IS NULL ORDER BY started_at DESC LIMIT 1'
    ).get(taskId) as TimeEntry | null;

    if (!active) return null;

    const now = new Date().toISOString();
    const durationMinutes = Math.floor(
      (Date.now() - new Date(active.started_at).getTime()) / 60000
    );

    // Apply rounding
    const roundedDuration = this.applyRounding(durationMinutes, active.rounding);

    db.prepare(
      'UPDATE time_entries SET stopped_at = ?, duration_minutes = ?, approved = 0 WHERE id = ?'
    ).run(now, roundedDuration, active.id);

    // Update task's actual_minutes
    const task = db.prepare('SELECT actual_minutes FROM tasks WHERE id = ?').get(active.task_id) as { actual_minutes: number } | null;
    if (task) {
      db.prepare(
        'UPDATE tasks SET actual_minutes = actual_minutes + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(roundedDuration, active.task_id);
    }

    return db.prepare('SELECT * FROM time_entries WHERE id = ?')
      .run(active.id) as TimeEntry;
  },

  update: (id: number, data: Partial<Omit<TimeEntry, 'id' | 'task_id' | 'started_at' | 'created_at'>>): void => {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.rounding !== undefined) {
      updates.push('rounding = ?');
      values.push(data.rounding);
    }
    if (data.approval_status !== undefined) {
      updates.push('approval_status = ?');
      values.push(data.approval_status);
      if (data.approval_status === 'approved' && !data.approval_at) {
        updates.push('approval_at = CURRENT_TIMESTAMP');
        values.push(new Date().toISOString());
      }
    }

    if (updates.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE time_entries SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  },

  deleteAllForTask: (taskId: number): void => {
    db.prepare('DELETE FROM time_entries WHERE task_id = ?').run(taskId);
  },

  // Get time report for a date range
  getTimeReport: (startDate: string, endDate: string): any[] => {
    return db.prepare(`
      SELECT
        t.id as task_id,
        t.name as task_name,
        SUM(te.duration_minutes) as total_minutes,
        te.rounding
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      WHERE date(te.started_at) >= date(?) AND date(te.started_at) <= date(?)
      GROUP BY te.task_id
      ORDER BY total_minutes DESC
    `).all(startDate, endDate);
  },

  // Apply rounding to duration
  applyRounding: (durationMinutes: number, rounding: 'none' | '5min' | '15min'): number => {
    switch (rounding) {
      case '5min':
        return Math.round(durationMinutes / 5) * 5;
      case '15min':
        return Math.round(durationMinutes / 15) * 15;
      default:
        return durationMinutes;
    }
  },

  // Submit for approval
  submitForApproval: (entryId: number): Promise<TimeEntry> => {
    return new Promise((resolve, reject) => {
      const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId);
      if (!entry) return reject(new Error('Time entry not found'));

      db.prepare(
        'UPDATE time_entries SET approval_status = ? WHERE id = ?'
      ).run('pending', entryId);

      const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
      resolve(updated);
    });
  },

  // Approve a time entry
  approveEntry: (entryId: number, approverId: number): Promise<TimeEntry> => {
    return new Promise((resolve, reject) => {
      db.prepare(
        'UPDATE time_entries SET approval_status = ?, approved = 1, approval_by = ?, approval_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run('approved', approverId, entryId);

      const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
      resolve(updated);
    });
  },

  // Reject a time entry
  rejectEntry: (entryId: number): Promise<TimeEntry> => {
    return new Promise((resolve, reject) => {
      db.prepare(
        'UPDATE time_entries SET approval_status = ?, approved = 0 WHERE id = ?'
      ).run('rejected', entryId);

      const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
      resolve(updated);
    });
  },

  // Get pending approvals
  getPendingApprovals: (): TimeEntry[] => {
    return db.prepare(
      'SELECT * FROM time_entries WHERE approval_status = ? ORDER BY started_at DESC'
    ).all('pending') as TimeEntry[];
  },

  // Payroll integration mock
  getPayrollData: (startDate: string, endDate: string): any[] => {
    return db.prepare(`
      SELECT
        t.id as task_id,
        t.name as task_name,
        SUM(te.duration_minutes) as total_minutes,
        u.email as assigned_to
      FROM time_entries te
      JOIN tasks t ON te.task_id = t.id
      LEFT JOIN users u ON t.list_id = u.id  -- simplified join
      WHERE date(te.started_at) >= date(?) AND date(te.started_at) <= date(?)
      GROUP BY te.task_id, u.email
      ORDER BY total_minutes DESC
    `).all(startDate, endDate);
  }
};