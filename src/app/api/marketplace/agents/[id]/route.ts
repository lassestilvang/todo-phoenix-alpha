import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In production, this would be backed by a real database
// Import the mock registry from the parent route
const MOCK_AGENT_REGISTRY = [
  {
    id: 'email-summarizer',
    name: 'Email Summarizer',
    version: '1.2.0',
    category: 'productivity',
    description: 'Analyzes emails and extracts actionable tasks',
    capabilities: ['parse-text', 'extract-tasks', 'priority-suggest'],
    inputs: [
      { name: 'emails', type: 'array', description: 'List of email contents', required: true },
      { name: 'timeframe', type: 'string', description: 'Analysis period', required: false, default: 'today' },
    ],
    outputs: [
      { name: 'tasks', type: 'task', description: 'Extracted tasks' },
      { name: 'summary', type: 'data', description: 'Summary statistics' },
    ],
    pricing: { model: 'freemium', limits: { requests: 100, 'max-emails': 50 } },
    requirements: { minMemory: '256MB', minCpu: '1 core' },
    security: { sandbox: true, isolationLevel: 'medium', auditLogging: true, dataHandling: 'user_only' },
    stats: { usageCount: 1250, successRate: 0.94, avgExecutionTime: 2.3, uptime: 0.98 },
    author: { name: 'Todo Phoenix Labs', email: 'labs@todophoenix.ai', verified: true },
    installs: 1250,
    rating: 4.7,
    health: 98,
    isVerified: true,
    isFeatured: true,
    lastUpdated: '2024-01-15',
  },
  {
    id: 'meeting-scheduler',
    name: 'Meeting Scheduler',
    version: '0.9.1',
    category: 'automation',
    description: 'Automatically schedules meetings based on calendar availability',
    capabilities: ['check-availability', 'find-slots', 'send-invitations'],
    inputs: [
      { name: 'attendees', type: 'array', description: 'List of attendees', required: true },
      { name: 'preferences', type: 'object', description: 'Scheduling preferences', required: false },
    ],
    outputs: [
      { name: 'meetings', type: 'task', description: 'Proposed meeting slots' },
      { name: 'invitation', type: 'notification', description: 'Calendar invitation' },
    ],
    pricing: { model: 'subscription', price: 9.99, currency: 'USD', interval: 'month', limits: { 'max-attendees': 20 } },
    requirements: { minMemory: '512MB', minCpu: '2 cores' },
    security: { sandbox: true, isolationLevel: 'high', auditLogging: true, dataHandling: 'user_only' },
    stats: { usageCount: 850, successRate: 0.89, avgExecutionTime: 5.1, uptime: 0.96 },
    author: { name: 'CalendarPro', email: 'contact@calendarpro.com', verified: true },
    installs: 850,
    rating: 4.5,
    health: 94,
    isVerified: true,
    isFeatured: false,
    lastUpdated: '2024-01-10',
  },
  {
    id: 'time-tracker',
    name: 'Intelligent Time Tracker',
    version: '2.1.0',
    category: 'productivity',
    description: 'Tracks time spent on tasks with AI-powered categorization',
    capabilities: ['track-time', 'categorize-activities', 'generate-reports'],
    inputs: [
      { name: 'activities', type: 'array', description: 'List of activities', required: true },
      { name: 'project', type: 'string', description: 'Project context', required: false },
    ],
    outputs: [
      { name: 'time-data', type: 'data', description: 'Processed time entries' },
      { name: 'insights', type: 'insight', description: 'Productivity insights' },
    ],
    pricing: { model: 'free' },
    requirements: { minMemory: '128MB', minCpu: '1 core' },
    security: { sandbox: false, isolationLevel: 'low', auditLogging: true, dataHandling: 'user_only' },
    stats: { usageCount: 2100, successRate: 0.92, avgExecutionTime: 1.8, uptime: 0.99 },
    author: { name: 'TimeFlow', email: 'support@timeflow.app', verified: false },
    installs: 2100,
    rating: 4.3,
    health: 99,
    isVerified: false,
    isFeatured: true,
    lastUpdated: '2024-01-20',
  },
  {
    id: 'task-prioritorizer',
    name: 'Task Prioritizer',
    version: '1.5.0',
    category: 'ai',
    description: 'AI-powered task prioritization based on deadlines, dependencies, and importance',
    capabilities: ['analyze-tasks', 'calculate-priority', 'suggest-order'],
    inputs: [
      { name: 'tasks', type: 'array', description: 'List of tasks to prioritize', required: true },
      { name: 'context', type: 'object', description: 'User context and preferences', required: false },
    ],
    outputs: [
      { name: 'prioritized-tasks', type: 'task', description: 'Tasks ordered by priority' },
      { name: 'recommendations', type: 'insight', description: 'Prioritization reasoning' },
    ],
    pricing: { model: 'paypercall', price: 0.1, currency: 'USD' },
    requirements: { minMemory: '256MB', minCpu: '2 cores' },
    security: { sandbox: true, isolationLevel: 'high', auditLogging: true, dataHandling: 'user_only' },
    stats: { usageCount: 600, successRate: 0.91, avgExecutionTime: 3.2, uptime: 0.95 },
    author: { name: 'SmartPriority', email: 'hello@smartpriority.ai', verified: true },
    installs: 600,
    rating: 4.8,
    health: 92,
    isVerified: true,
    isFeatured: true,
    lastUpdated: '2024-01-05',
  },
];

// Helper to find agent by ID
function findAgentById(id: string) {
  return MOCK_AGENT_REGISTRY.find((a) => a.id === id);
}

// GET - Get a specific agent by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = findAgentById(id);

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ agent });
}

// POST - Install/uninstall/execute an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'install';
  const agent = findAgentById(id);

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  try {
    if (action === 'install') {
      // Simulate installing an agent
      console.log(`Installing agent: ${id}`);
      return NextResponse.json({ success: true, message: `Agent ${id} installed successfully` });
    } else if (action === 'uninstall') {
      // Simulate uninstalling an agent
      console.log(`Uninstalling agent: ${id}`);
      return NextResponse.json({ success: true, message: `Agent ${id} uninstalled successfully` });
    } else if (action === 'execute') {
      // Simulate executing an agent
      const body = await request.json();
      console.log(`Executing agent: ${id} with input:`, body.input);

      // Mock execution result based on agent type
      let mockResult: any = { status: 'completed', output: 'Task completed successfully', executionTime: 2.5 };

      if (agent.id === 'email-summarizer') {
        mockResult = {
          status: 'completed',
          output: {
            tasks: [
              { title: 'Reply to client email', priority: 'high', dueDate: new Date().toISOString() },
              { title: 'Review project proposal', priority: 'medium', dueDate: new Date(Date.now() + 86400000).toISOString() }
            ],
            summary: { totalEmails: 5, tasksExtracted: 2, urgentItems: 1 }
          },
          executionTime: 2.3
        };
      } else if (agent.id === 'meeting-scheduler') {
        mockResult = {
          status: 'completed',
          output: {
            meetings: [
              { time: '2024-01-15T10:00:00Z', duration: 30, attendees: body.input?.attendees || [] },
              { time: '2024-01-15T14:00:00Z', duration: 60, attendees: body.input?.attendees || [] }
            ],
            invitation: { sent: true, recipients: body.input?.attendees || [] }
          },
          executionTime: 5.1
        };
      } else if (agent.id === 'time-tracker') {
        mockResult = {
          status: 'completed',
          output: {
            timeData: body.input?.activities?.map((a: any) => ({ ...a, trackedTime: Math.random() * 3600000 })) || [],
            insights: { mostProductive: 'Morning', totalTracked: 7.5, categories: { work: 5.2, meetings: 1.8, breaks: 0.5 } }
          },
          executionTime: 1.8
        };
      } else if (agent.id === 'task-prioritorizer') {
        mockResult = {
          status: 'completed',
          output: {
            prioritizedTasks: body.input?.tasks?.map((t: any, i: number) => ({ ...t, priorityScore: Math.random() * 100 })).sort((a: any, b: any) => b.priorityScore - a.priorityScore) || [],
            recommendations: ['Focus on high-impact tasks first', 'Delegate low-priority items', 'Batch similar tasks together']
          },
          executionTime: 3.2
        };
      }

      // Update stats (in production, this would update a database)
      agent.stats.usageCount += 1;
      (agent.stats as any).lastExecution = new Date().toISOString();

      return NextResponse.json({
        success: true,
        result: mockResult
      });
    } else {
      return NextResponse.json(
        { error: `Unsupported action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error executing agent action:', error);
    return NextResponse.json(
      { error: 'Failed to execute agent action' },
      { status: 500 }
    );
  }
}