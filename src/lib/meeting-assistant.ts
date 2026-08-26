import { Anthropic } from '@anthropic-ai/sdk';
import { TaskFormData } from './types';

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MeetingData {
  id?: string;
  title: string;
  date: string;
  durationMinutes: number;
  attendees: string[];
  transcript?: string;
  notes?: string;
  platform?: 'zoom' | 'teams' | 'google-meet' | 'in-person' | 'other';
  recordingUrl?: string;
}

export interface ExtractedActionItem {
  taskName: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  relatedTopics: string[];
  confidence: number;
  context: string;
}

export interface MeetingInsights {
  summary: string;
  actionItems: ExtractedActionItem[];
  decisions: string[];
  keyTopics: string[];
  followUpNeeded: boolean;
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  meetingEffectiveness: number; // 0-100
}

export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  agenda: string[];
  defaultDuration: number;
  typicalAttendees: string[];
}

export const DEFAULT_MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'standup',
    name: 'Daily Standup',
    description: 'Quick daily team sync',
    agenda: ['What did you complete yesterday?', 'What will you tackle today?', 'Any blockers?'],
    defaultDuration: 15,
    typicalAttendees: ['team']
  },
  {
    id: 'planning',
    name: 'Sprint Planning',
    description: 'Plan work for upcoming sprint',
    agenda: ['Review backlog', 'Estimate stories', 'Commit to sprint goals'],
    defaultDuration: 60,
    typicalAttendees: ['team', 'product-owner', 'scrum-master']
  },
  {
    id: 'retrospective',
    name: 'Sprint Retrospective',
    description: 'Reflect on past sprint and improve',
    agenda: ['What went well?', 'What could be improved?', 'Action items for next sprint'],
    defaultDuration: 45,
    typicalAttendees: ['team']
  },
  {
    id: 'one-on-one',
    name: 'One-on-One',
    description: 'Manager-employee check-in',
    agenda: ['Progress update', 'Challenges', 'Career growth', 'Feedback'],
    defaultDuration: 30,
    typicalAttendees: ['manager', 'employee']
  },
  {
    id: 'review',
    name: 'Design Review',
    description: 'Review designs and get feedback',
    agenda: ['Present design', 'Gather feedback', 'Decide on changes'],
    defaultDuration: 45,
    typicalAttendees: ['designers', 'developers', 'product']
  },
  {
    id: 'client',
    name: 'Client Meeting',
    description: 'External client meeting',
    agenda: ['Project status', 'Discuss requirements', 'Next steps', 'Action items'],
    defaultDuration: 60,
    typicalAttendees: ['client', 'account-manager', 'technical-lead']
  }
];

/**
 * Analyze meeting transcript/notes and extract action items and insights
 */
export async function analyzeMeeting(meeting: MeetingData): Promise<MeetingInsights> {
  const prompt = `
Analyze this meeting and provide structured insights:

Meeting: ${meeting.title}
Date: ${meeting.date}
Duration: ${meeting.durationMinutes} minutes
Attendees: ${meeting.attendees.join(', ')}
Platform: ${meeting.platform || 'unknown'}

${meeting.transcript ? `Transcript:\n${meeting.transcript}` : ''}
${meeting.notes ? `Notes:\n${meeting.notes}` : ''}

Please provide:
1. A concise summary (2-3 sentences)
2. Action items with assignee, due date, priority, and time estimate
3. Key decisions made
4. Main topics discussed
5. Whether follow-up is needed
6. Next steps
7. Overall sentiment (positive/neutral/negative)
8. Meeting effectiveness score (0-100)

Respond with JSON in this exact format:
{
  "summary": "string",
  "actionItems": [
    {
      "taskName": "string",
      "description": "string",
      "assignee": "string or null",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "high|medium|low",
      "estimatedMinutes": number,
      "relatedTopics": ["string"],
      "confidence": number,
      "context": "string"
    }
  ],
  "decisions": ["string"],
  "keyTopics": ["string"],
  "followUpNeeded": boolean,
  "nextSteps": ["string"],
  "sentiment": "positive|neutral|negative",
  "meetingEffectiveness": number
}
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      system: 'You are an AI assistant specialized in analyzing meeting transcripts and extracting actionable insights. Be precise and practical.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const resultBlock = response.content[0];
    if (!resultBlock || !('text' in resultBlock)) {
      throw new Error('No response from Claude API');
    }

    const result = (resultBlock as { text: string }).text;
    if (!result) {
      throw new Error('No response from Claude API');
    }

    // Parse JSON from Claude's response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error analyzing meeting:', error);
    // Return fallback
    return {
      summary: 'Meeting analysis unavailable',
      actionItems: [],
      decisions: [],
      keyTopics: [],
      followUpNeeded: false,
      nextSteps: [],
      sentiment: 'neutral',
      meetingEffectiveness: 50
    };
  }
}

/**
 * Create tasks from extracted action items
 */
export async function createTasksFromActionItems(
  actionItems: ExtractedActionItem[],
  listId: number,
  meetingTitle: string
): Promise<TaskFormData[]> {
  return actionItems.map(item => ({
    name: `${meetingTitle}: ${item.taskName}`,
    description: item.description + (item.context ? `\n\nContext: ${item.context}` : ''),
    estimate_minutes: item.estimatedMinutes,
    priority: item.priority,
    deadline: item.dueDate ? new Date(item.dueDate).toISOString() : undefined,
    // We'll add labels for meeting-related tasks
    label_ids: [/* meeting label id */]
  }));
}

/**
 * Generate meeting follow-up summary
 */
export async function generateMeetingFollowUp(
  previousMeeting: MeetingData,
  newActionItems: ExtractedActionItem[],
  completedTasks: string[]
): Promise<string> {
  const prompt = `
Generate a follow-up summary for the next meeting based on:

Previous Meeting: ${previousMeeting.title} (${previousMeeting.date})
Completed Tasks: ${completedTasks.join(', ') || 'None'}
New Action Items: ${newActionItems.map(a => `${a.taskName} (${a.assignee || 'unassigned'})`).join(', ')}

Create a brief follow-up summary covering:
1. What was completed since last meeting
2. What's still pending
3. New items to discuss
4. Any blockers or concerns

Keep it concise and professional.
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.4,
      system: 'You are an AI assistant that creates professional meeting follow-up summaries.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const resultBlock = response.content[0];
    if (!resultBlock || !('text' in resultBlock)) {
      throw new Error('No response from Claude API');
    }

    return (resultBlock as { text: string }).text;
  } catch (error) {
    console.error('Error generating follow-up:', error);
    return 'Follow-up summary unavailable';
  }
}

/**
 * Get meeting templates
 */
export function getMeetingTemplates(): MeetingTemplate[] {
  return DEFAULT_MEETING_TEMPLATES;
}

/**
 * Get meeting template by ID
 */
export function getMeetingTemplate(id: string): MeetingTemplate | undefined {
  return DEFAULT_MEETING_TEMPLATES.find(t => t.id === id);
}

/**
 * Create a custom meeting template
 */
export function createMeetingTemplate(template: Omit<MeetingTemplate, 'id'>): MeetingTemplate {
  return {
    ...template,
    id: `custom-${Date.now()}`
  };
}

/**
 * Analyze meeting effectiveness based on completion of action items
 */
export async function analyzeMeetingEffectiveness(
  meetings: MeetingData[],
  completedActionItems: number,
  totalActionItems: number
): Promise<{
  effectivenessScore: number;
  trends: { improving: boolean; completionRate: number };
  recommendations: string[];
}> {
  const completionRate = totalActionItems > 0 ? completedActionItems / totalActionItems : 0;
  const effectivenessScore = Math.round(completionRate * 100);

  const improving = effectivenessScore > 70;

  const recommendations: string[] = [];
  if (completionRate < 0.5) {
    recommendations.push('Consider shorter meetings with more focused agendas');
    recommendations.push('Assign clear owners and deadlines for each action item');
  }
  if (completionRate < 0.3) {
    recommendations.push('Review meeting necessity - some may be replaced by async updates');
  }
  if (meetings.some(m => m.durationMinutes > 60 && m.actionItems?.length && m.actionItems.length > 5)) {
    recommendations.push('Long meetings with many action items may benefit from splitting into focused sessions');
  }

  return {
    effectivenessScore,
    trends: { improving, completionRate },
    recommendations
  };
}

/**
 * Sync meeting action items with calendar
 */
export async function syncMeetingActionItemsToCalendar(
  actionItems: ExtractedActionItem[],
  calendarId?: string
): Promise<{ success: number; failed: number }> {
  // This would integrate with Google Calendar, Outlook, etc.
  // For now, return a placeholder
  return {
    success: actionItems.length,
    failed: 0
  };
}

/**
 * Get meeting statistics
 */
export function getMeetingStats(meetings: MeetingData[]): {
  totalMeetings: number;
  totalDuration: number;
  averageDuration: number;
  platformsUsed: Record<string, number>;
  mostCommonAttendees: string[];
} {
  const totalMeetings = meetings.length;
  const totalDuration = meetings.reduce((sum, m) => sum + m.durationMinutes, 0);
  const averageDuration = totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0;

  const platformsUsed: Record<string, number> = {};
  meetings.forEach(m => {
    const platform = m.platform || 'unknown';
    platformsUsed[platform] = (platformsUsed[platform] || 0) + 1;
  });

  const attendeeCounts: Record<string, number> = {};
  meetings.forEach(m => {
    m.attendees.forEach(a => {
      attendeeCounts[a] = (attendeeCounts[a] || 0) + 1;
    });
  });

  const mostCommonAttendees = Object.entries(attendeeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name]) => name);

  return {
    totalMeetings,
    totalDuration,
    averageDuration,
    platformsUsed,
    mostCommonAttendees
  };
}