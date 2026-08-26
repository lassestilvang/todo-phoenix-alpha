import db from './db/schema';
import { Task, TaskWithDetails } from './types';
import { generateTaskSuggestions } from './ai/enhancement';

// Types for search
export interface SearchFilters {
  priority?: string[];
  listId?: number;
  dateRange?: [string, string];
  hasAttachments?: boolean;
  hasReminders?: boolean;
  isCompleted?: boolean;
  hasSubtasks?: boolean;
  labels?: number[];
}

export interface SearchOptions {
  fuzzy?: boolean;
  fuzzyThreshold?: number;
  semantic?: boolean;
  semanticThreshold?: number;
  sortBy?: 'date' | 'priority' | 'created' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  tasks: Task[];
  total: number;
  fuzzyMatches?: {
    original: string;
    corrected: string;
    score: number;
  }[];
  suggestions?: string[];
}

export interface SavedSearch {
  id?: number;
  name: string;
  query: string;
  filters: SearchFilters;
  options?: SearchOptions;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class SearchService {
  private static instance: SearchService;

  // Fuzzy search algorithm
  static fuzzySearch(str1: string, str2: string, threshold = 0.6): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 0;

    const editDistance = SearchService.calculateEditDistance(longer, shorter);
    const similarity = 1 - (editDistance / longer.length);

    return similarity >= threshold ? similarity : 0;
  }

  static calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // insertion
          matrix[j - 1][i] + 1,      // deletion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Text normalization for better matching
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\-_]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  // Generate contextual suggestions based on task patterns
  static async generateContextualSuggestions(
    query: string,
    context?: { userTasks: Task[]; userLists: any[] }
  ): Promise<string[]> {
    const suggestions = new Set<string>();

    if (!context) return Array.from(suggestions);

    // Extract words from query for intelligent suggestions
    const queryWords = SearchService.normalizeText(query).split(' ');

    // Suggest recent task patterns
    const commonTerms = new Map<string, number>();
    context.userTasks.forEach(task => {
      const taskWords = SearchService.normalizeText(task.name).split(' ');
      taskWords.forEach(word => {
        if (word.length > 3) {
          commonTerms.set(word, (commonTerms.get(word) || 0) + 1);
        }
      });
    });

    // Suggest based on query prefixes
    commonTerms.forEach((count, term) => {
      queryWords.forEach(word => {
        if (word.length >= 3 && term.startsWith(word.substring(0, 3))) {
          suggestions.add(term);
        }
      });
    });

    // Add AI-generated suggestions
    try {
      const aiSuggestions = await generateTaskSuggestions({
        name: query,
        description: '',
        estimate_minutes: 30,
        priority: 'medium'
      });

      if (aiSuggestions.relatedTasks?.length > 0) {
        // This would normally fetch related task names
        suggestions.add(`Related to: ${query}`);
      }
    } catch (error) {
      console.warn('Failed to generate AI suggestions:', error);
    }

    return Array.from(suggestions).slice(0, 5);
  }

  // Main search method combining fuzzy and semantic search
  static async search(
    query: string,
    filters?: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const {
      fuzzy = true,
      fuzzyThreshold = 0.7,
      semantic = true,
      semanticThreshold = 0.8,
      sortBy = 'relevance'
    } = options;

    const normalizedQuery = SearchService.normalizeText(query);
    let tasks: Task[] = [];
    const fuzzyMatches: { original: string; corrected: string; score: number }[] = [];

    // Try fuzzy search first
    if (fuzzy && normalizedQuery.length > 0) {
      const allTasks = db.prepare('SELECT * FROM tasks').all() as Task[];

      for (const task of allTasks) {
        const taskName = SearchService.normalizeText(task.name);
        const taskDescription = task.description
          ? SearchService.normalizeText(task.description)
          : '';

        const nameSimilarity = SearchService.fuzzySearch(normalizedQuery, taskName, fuzzyThreshold);
        const descSimilarity = taskDescription
          ? SearchService.fuzzySearch(normalizedQuery, taskDescription, fuzzyThreshold)
          : 0;

        const maxSimilarity = Math.max(nameSimilarity, descSimilarity);

        if (maxSimilarity >= fuzzyThreshold) {
          if (maxSimilarity < 1.0) {
            fuzzyMatches.push({
              original: query,
              corrected: normalizedQuery,
              score: maxSimilarity
            });
          }

          tasks.push(task);
        }
      }
    }

    // Fallback to exact LIKE search if fuzzy search didn't find results
    if (tasks.length === 0 && !fuzzy) {
      const searchTerm = `%${query}%`;
      tasks = db.prepare(
        `SELECT * FROM tasks WHERE name LIKE ? OR description LIKE ?`
      ).all(searchTerm, searchTerm) as Task[];
    }

    // Apply semantic search if enabled and we have AI available
    if (semantic && normalizedQuery.length > 0) {
      try {
        const semanticResults = await SearchService.semanticSearch(normalizedQuery);

        // Merge semantic results with fuzzy results
        const semanticTaskIds = new Set(semanticResults.map(t => t.id));
        const combinedTasks = [...tasks];

        for (const semanticTask of semanticResults) {
          if (!combinedTasks.find(t => t.id === semanticTask.id)) {
            combinedTasks.push(semanticTask);
          }
        }

        tasks = combinedTasks;
      } catch (error) {
        console.warn('Semantic search failed, using fuzzy search only:', error);
      }
    }

    // Apply filters
    if (filters) {
      tasks = tasks.filter(task => {
        if (filters.priority && filters.priority.length > 0) {
          if (!filters.priority.includes(task.priority)) return false;
        }

        if (filters.listId && task.list_id !== filters.listId) return false;

        if (filters.dateRange && task.date) {
          const [start, end] = filters.dateRange;
          if (task.date < start || task.date > end) return false;
        }

        if (filters.hasAttachments !== undefined) {
          const hasAttachments = db.prepare(
            'SELECT COUNT(*) as count FROM attachments WHERE task_id = ?'
          ).get(task.id) as { count: number };
          if (hasAttachments.count > 0 !== filters.hasAttachments) return false;
        }

        if (filters.hasReminders !== undefined) {
          const hasReminders = db.prepare(
            'SELECT COUNT(*) as count FROM reminders WHERE task_id = ?'
          ).get(task.id) as { count: number };
          if (hasReminders.count > 0 !== filters.hasReminders) return false;
        }

        if (filters.isCompleted !== undefined) {
          const isCompleted = task.is_completed === 1;
          if (isCompleted !== filters.isCompleted) return false;
        }

        if (filters.hasSubtasks !== undefined) {
          const hasSubtasks = db.prepare(
            'SELECT COUNT(*) as count FROM subtasks WHERE task_id = ?'
          ).get(task.id) as { count: number };
          if (hasSubtasks.count > 0 !== filters.hasSubtasks) return false;
        }

        if (filters.labels && filters.labels.length > 0) {
          const labels = db.prepare(
            'SELECT label_id FROM task_labels WHERE task_id = ?'
          ).all(task.id) as { label_id: number }[];
          const taskLabelIds = labels.map(l => l.label_id);
          if (!filters.labels.some(id => taskLabelIds.includes(id))) return false;
        }
      });
    }

    // Apply sorting
    if (sortBy !== 'relevance') {
      tasks.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'date':
            comparison = (a.date || '').localeCompare(b.date || '');
            break;
          case 'priority':
            comparison = a.priority.localeCompare(b.priority);
            break;
          case 'created':
            comparison = (a.created_at || '').localeCompare(b.created_at || '');
            break;
          case 'relevance':
            // Keep fuzzy matches first
            const aFuzzy = fuzzyMatches.find(m => m.original === SearchService.normalizeText(a.name));
            const bFuzzy = fuzzyMatches.find(m => m.original === SearchService.normalizeText(b.name));
            if (aFuzzy && !bFuzzy) comparison = -1;
            else if (!aFuzzy && bFuzzy) comparison = 1;
            else comparison = 0;
            break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return {
      tasks,
      total: tasks.length,
      fuzzyMatches: fuzzyMatches.length > 0 ? fuzzyMatches : undefined,
      suggestions: normalizedQuery.length > 0 ? await SearchService.generateContextualSuggestions(query) : undefined
    };
  }

  // Semantic search using AI to find related tasks
  static async semanticSearch(query: string): Promise<Task[]> {
    try {
      const suggestions = await generateTaskSuggestions({
        name: query,
        description: '',
        estimate_minutes: 30,
        priority: 'medium'
      });

      // In a real implementation, we would:
      // 1. Generate embeddings for the query
      // 2. Query tasks by semantic similarity
      // 3. Return the top matches

      // For now, return an empty array to fallback to fuzzy search
      return [];
    } catch (error) {
      console.warn('Semantic search failed:', error);
      return [];
    }
  }

  // Get popular search queries for suggestions
  static getPopularSearches(limit: number = 10): string[] {
    // In a real implementation, this would query from search history
    // For now, return some common queries
    return [
      'follow up',
      'urgent',
      'meeting',
      'call',
      'review',
      'complete',
      'today',
      'tomorrow',
      'priority',
      'important'
    ].slice(0, limit);
  }

  // Save a search for later use
  static saveSearch(search: SavedSearch): SavedSearch {
    const result = db.prepare(
      `INSERT INTO saved_searches (
        name, query, filters, options, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      search.name,
      search.query,
      JSON.stringify(search.filters),
      JSON.stringify(search.options || {}),
      search.userId || 'default',
      new Date().toISOString(),
      new Date().toISOString()
    );

    return {
      ...search,
      id: result.lastInsertRowid as number,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Get saved searches for a user
  static getSavedSearches(userId?: string): SavedSearch[] {
    const user = userId || 'default';
    return db.prepare(
      'SELECT * FROM saved_searches WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(user) as SavedSearch[];
  }

  // Delete a saved search
  static deleteSearch(id: number): void {
    db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id);
  }

  // Get search analytics
  static getSearchAnalytics(days: number = 30): any {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return {
      totalSearches: db.prepare('SELECT COUNT(*) as count FROM search_analytics WHERE created_at >= ?').get(since) as { count: number },
      popularQueries: db.prepare(
        `SELECT query, COUNT(*) as count
         FROM search_analytics
         WHERE created_at >= ?
         GROUP BY query
         ORDER BY count DESC
         LIMIT 10`
      ).all(since),
      searchByDay: db.prepare(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM search_analytics
         WHERE created_at >= ?
         GROUP BY DATE(created_at)
         ORDER BY date`
      ).all(since)
    };
  }

  // Log search for analytics
  static logSearch(
    query: string,
    userId?: string,
    filters?: SearchFilters,
    resultsCount?: number
  ): void {
    db.prepare(
      `INSERT INTO search_analytics (
        query, user_id, filters, results_count, created_at
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(
      query,
      userId || 'default',
      JSON.stringify(filters || {}),
      resultsCount || 0,
      new Date().toISOString()
    );
  }

  // Create smart folders based on patterns
  static createSmartFolder(name: string, filterQuery: string, filters: SearchFilters): void {
    db.prepare(
      `INSERT INTO smart_folders (name, filter_query, filters, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      name,
      filterQuery,
      JSON.stringify(filters),
      new Date().toISOString()
    );
  }

  // Get all smart folders
  static getSmartFolders(): any[] {
    return db.prepare('SELECT * FROM smart_folders ORDER BY name').all() as any[];
  }

  // Get tasks in a smart folder
  static getSmartFolderTasks(folderId: number): Task[] {
    const folder = db.prepare('SELECT * FROM smart_folders WHERE id = ?').get(folderId) as any;
    if (!folder) return [];

    const filters = JSON.parse(folder.filters);
    // Execute search with filters
    return SearchService.search(folder.filter_query, filters).then(result => result.tasks);
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }
}

// Initialize database tables for search functionality
const initSearchDatabase = () => {
  if (typeof window === 'undefined') {
    try {
      const Database = require('better-sqlite3');
      const dbPath = require('path').join(process.cwd(), 'data', 'planner.db');
      const dbInstance = new Database(dbPath);

      // Create saved_searches table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS saved_searches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          query TEXT NOT NULL,
          filters TEXT,
          options TEXT,
          user_id TEXT DEFAULT 'default',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Create smart_folders table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS smart_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          filter_query TEXT NOT NULL,
          filters TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Create search_analytics table
      dbInstance.exec(
        `CREATE TABLE IF NOT EXISTS search_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          user_id TEXT DEFAULT 'default',
          filters TEXT,
          results_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Create indexes
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(created_at)');
      dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query)');

      console.log('Search database tables created successfully');
    } catch (error) {
      console.warn('Failed to initialize search database:', error);
    }
  }
};

// Initialize search database
initSearchDatabase();

export { SearchService };