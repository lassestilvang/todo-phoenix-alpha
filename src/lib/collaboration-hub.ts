import db from './db/schema';

/**
 * Collaborative Intelligence Hub
 * Enables real-time collaboration, AI-powered brainstorming, and consensus building
 */

// Database tables are now initialized in src/lib/db/schema.ts
// This module uses the shared db instance

export interface CollaborationSession {
  id: string;
  userId: string;
  taskId: number;
  sessionType: 'brainstorm' | 'review' | 'planning' | 'editing';
  startedAt: string;
  endedAt?: string;
  participants: string[];
  status: 'active' | 'completed' | 'cancelled';
}

export interface BrainstormIdea {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  votes: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  parentId?: string; // For idea hierarchies
}

export interface CollaborationComment {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  mentions: string[]; // User IDs mentioned
  reactions: Record<string, number>; // Emoji -> count
}

export interface ConsensusResult {
  ideaId: string;
  agreementLevel: number; // 0-100
  supportingVotes: number;
  opposingVotes: number;
  abstentions: number;
  finalDecision: 'accept' | 'reject' | 'modify' | 'defer';
  reasoning: string;
}

export interface CollaborationMetrics {
  totalSessions: number;
  activeSessions: number;
  ideasGenerated: number;
  consensusReached: number;
  averageSessionDuration: number;
}

// Database tables are now initialized in src/lib/db/schema.ts
// This module uses the shared db instance from schema.ts

// Collaboration operations
export const collaborationHub = {
  // Start a collaboration session
  startSession: (userId: string, taskId: number, sessionType: CollaborationSession['sessionType'], participants: string[] = []): string => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      db.prepare(`
        INSERT INTO collaboration_sessions (id, user_id, task_id, session_type, participants, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(sessionId, userId, taskId, sessionType, JSON.stringify(participants));

      return sessionId;
    } catch (e) {
      console.error('Failed to start collaboration session:', e);
      throw e;
    }
  },

  // End a collaboration session
  endSession: (sessionId: string): void => {
    try {
      db.prepare(`
        UPDATE collaboration_sessions
        SET ended_at = CURRENT_TIMESTAMP, status = 'completed'
        WHERE id = ?
      `).run(sessionId);
    } catch (e) {
      console.error('Failed to end collaboration session:', e);
      throw e;
    }
  },

  // Add a brainstorm idea
  addIdea: (sessionId: string, userId: string, content: string, tags: string[] = [], parentId?: string): string => {
    const ideaId = `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      db.prepare(`
        INSERT INTO brainstorm_ideas (id, session_id, user_id, content, tags, parent_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ideaId, sessionId, userId, content, JSON.stringify(tags), parentId || null);

      return ideaId;
    } catch (e) {
      console.error('Failed to add brainstorm idea:', e);
      throw e;
    }
  },

  // Vote on an idea
  voteOnIdea: (ideaId: string, userId: string, vote: 1 | -1): void => {
    try {
      // Check if user already voted
      const existingVote = db.prepare(`
        SELECT vote_value FROM idea_votes WHERE idea_id = ? AND user_id = ?
      `).get(ideaId, userId);

      if (existingVote) {
        // Update existing vote
        db.prepare(`
          UPDATE idea_votes SET vote_value = ?, updated_at = CURRENT_TIMESTAMP
          WHERE idea_id = ? AND user_id = ?
        `).run(vote, ideaId, userId);
      } else {
        // Insert new vote
        db.prepare(`
          INSERT INTO idea_votes (idea_id, user_id, vote_value, created_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(ideaId, userId, vote);
      }

      // Update idea vote count
      const voteResult = db.prepare(`
        SELECT
          SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END) as upvotes,
          SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END) as downvotes
        FROM idea_votes WHERE idea_id = ?
      `).get(ideaId);

      const netVotes = (voteResult.upvotes || 0) - (voteResult.downvotes || 0);

      db.prepare(`
        UPDATE brainstorm_ideas
        SET votes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(netVotes, ideaId);
    } catch (e) {
      console.error('Failed to vote on idea:', e);
      throw e;
    }
  },

  // Add a comment to a session
  addComment: (sessionId: string, userId: string, content: string, mentions: string[] = []): string => {
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      db.prepare(`
        INSERT INTO collaboration_comments (id, session_id, user_id, content, mentions)
        VALUES (?, ?, ?, ?, ?)
      `).run(commentId, sessionId, userId, content, JSON.stringify(mentions));

      return commentId;
    } catch (e) {
      console.error('Failed to add comment:', e);
      throw e;
    }
  },

  // React to a comment
  reactToComment: (commentId: string, userId: string, reaction: string): void => {
    try {
      // Get current reactions
      const comment = db.prepare(`
        SELECT reactions FROM collaboration_comments WHERE id = ?
      `).get(commentId) as { reactions: string } | undefined;

      let reactions: Record<string, number> = {};
      if (comment?.reactions) {
        try {
          reactions = JSON.parse(comment.reactions);
        } catch {
          reactions = {};
        }
      }

      // Toggle reaction
      if (reactions[reaction]) {
        reactions[reaction]--;
        if (reactions[reaction] <= 0) {
          delete reactions[reaction];
        }
      } else {
        reactions[reaction] = (reactions[reaction] || 0) + 1;
      }

      // Update database
      db.prepare(`
        UPDATE collaboration_comments
        SET reactions = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(reactions), commentId);
    } catch (e) {
      console.error('Failed to react to comment:', e);
      throw e;
    }
  },

  // Get session ideas sorted by votes
  getSessionIdeas: (sessionId: string): BrainstormIdea[] => {
    try {
      return db.prepare(`
        SELECT * FROM brainstorm_ideas
        WHERE session_id = ?
        ORDER BY votes DESC, created_at ASC
      `).all(sessionId) as BrainstormIdea[];
    } catch (e) {
      console.error('Failed to get session ideas:', e);
      return [];
    }
  },

  // Get session comments
  getSessionComments: (sessionId: string): CollaborationComment[] => {
    try {
      return db.prepare(`
        SELECT * FROM collaboration_comments
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionId) as CollaborationComment[];
    } catch (e) {
      console.error('Failed to get session comments:', e);
      return [];
    }
  },

  // Reach consensus on an idea
  reachConsensus: (ideaId: string, sessionId: string, decision: ConsensusResult['finalDecision'], reasoning: string): string => {
    const consensusId = `consensus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get idea details
      const idea = db.prepare(`
        SELECT * FROM brainstorm_ideas WHERE id = ?
      `).get(ideaId);

      if (!idea) throw new Error('Idea not found');

      // Calculate agreement level based on votes
      const voteResult = db.prepare(`
        SELECT
          SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END) as upvotes,
          SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END) as downvotes,
          COUNT(*) as total_votes
        FROM idea_votes WHERE idea_id = ?
      `).get(ideaId);

      const totalVotes = voteResult.total_votes || 0;
      const netVotes = (voteResult.upvotes || 0) - (voteResult.downvotes || 0);
      const agreementLevel = totalVotes > 0
        ? Math.round(((netVotes + totalVotes) / (2 * totalVotes)) * 100)
        : 50; // Default to neutral if no votes

      db.prepare(`
        INSERT INTO consensus_results (
          id, idea_id, session_id, agreement_level,
          supporting_votes, opposing_votes, abstentions,
          final_decision, reasoning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        consensusId,
        ideaId,
        sessionId,
        agreementLevel,
        voteResult.upvotes || 0,
        voteResult.downvotes || 0,
        totalVotes - ((voteResult.upvotes || 0) + (voteResult.downvotes || 0)),
        decision,
        reasoning
      );

      return consensusId;
    } catch (e) {
      console.error('Failed to reach consensus:', e);
      throw e;
    }
  },

  // Get collaboration metrics
  getMetrics: (): CollaborationMetrics => {
    try {
      const sessions = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM collaboration_sessions
      `).get() as { total: number; active: number };

      const ideas = db.prepare(`
        SELECT COUNT(*) as count FROM brainstorm_ideas
      `).get() as { count: number };

      const consensus = db.prepare(`
        SELECT COUNT(*) as count FROM consensus_results
      `).get() as { count: number };

      const avgDuration = db.prepare(`
        SELECT AVG(
          CASE
            WHEN ended_at IS NOT NULL
            THEN (julianday(ended_at) - julianday(started_at)) * 24 * 60
            ELSE (julianday('now') - julianday(started_at)) * 24 * 60
          END
        ) as avg_minutes
        FROM collaboration_sessions
      `).get() as { avg_minutes: number };

      return {
        totalSessions: sessions.total,
        activeSessions: sessions.active,
        ideasGenerated: ideas.count,
        consensusReached: consensus.count,
        averageSessionDuration: Math.round(avgDuration.avg_minutes || 0)
      };
    } catch (e) {
      console.error('Failed to get collaboration metrics:', e);
      return {
        totalSessions: 0,
        activeSessions: 0,
        ideasGenerated: 0,
        consensusReached: 0,
        averageSessionDuration: 0
      };
    }
  },

  // AI-powered brainstorming assistance
  generateIdeaSuggestions: async (sessionId: string, context: string): Promise<string[]> => {
    try {
      // Get existing ideas for context
      const existingIdeas = await collaborationHub.getSessionIdeas(sessionId);

      // Convert context to idea suggestions
      const baseSuggestions = [
        `Expand on: ${context}`,
        `Combine ideas from: ${existingIdeas.slice(0, 3).map(i => i.content).join(', ')}`,
        `Consider opposite approach to: ${context}`,
        `What if we had unlimited resources for: ${context}?`,
        `What would be the minimal viable version of: ${context}?`,
        `How would [expert/role model] approach: ${context}?`,
        `What are the risks and mitigations for: ${context}?`,
        `What resources are needed for: ${context}?`
      ];

      // Filter out suggestions that are too similar to existing ideas
      const uniqueSuggestions = baseSuggestions.filter(suggestion =>
        !existingIdeas.some(idea =>
          suggestion.toLowerCase().includes(idea.content.toLowerCase().substring(0, Math.min(20, idea.content.length)))
        )
      );

      return uniqueSuggestions.slice(0, 5);
    } catch (e) {
      console.error('Failed to generate idea suggestions:', e);
      return [
        `Brainstorm more ideas about: ${context}`,
        `Consider different perspectives on: ${context}`,
        `What are the key challenges in: ${context}?`
      ];
    }
  }
};