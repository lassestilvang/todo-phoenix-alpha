import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In production, this would be backed by a real database
// For now, we have a static registry of available agents

// Agent categories and their descriptions
const AGENT_CATEGORIES = [
  { value: 'ai', label: 'AI & Machine Learning', icon: '🤖' },
  { value: 'productivity', label: 'Productivity', icon: '📈' },
  { value: 'communication', label: 'Communication', icon: '💬' },
  { value: 'analysis', label: 'Data Analysis', icon: '📊' },
  { value: 'automation', label: 'Automation', icon: '⚙️' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'integration', label: 'Integrations', icon: '🔗' },
  { value: 'utility', label: 'Utilities', icon: '⚙️' },
];

// Mock agent registry - in production, this would be a database
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

// GET - List available agents
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('search') || '';
  const featuredOnly = searchParams.get('featured') === 'true';
  const minRating = searchParams.get('minRating');

  let agents = [...MOCK_AGENT_REGISTRY];

  // Filter by category
  if (category !== 'all') {
    agents = agents.filter((a) => a.category === category);
  }

  // Filter by search
  if (search) {
    agents = agents.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Filter by featured
  if (featuredOnly) {
    agents = agents.filter((a) => a.isFeatured);
  }

  // Filter by minimum rating
  if (minRating) {
    const minRatingNum = parseFloat(minRating);
    agents = agents.filter((a) => a.rating >= minRatingNum);
  }

  return NextResponse.json({ agents, total: agents.length });
}

// POST - Register a new agent (for marketplace sellers)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'description', 'capabilities', 'category'];
    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Create new agent entry
    const newAgent = {
      id: body.id || `agent-${Date.now()}`,
      name: body.name,
      description: body.description,
      version: body.version || '0.1.0',
      category: body.category,
      tags: body.tags || [],
      capabilities: body.capabilities || [],
      inputs: body.inputs || [],
      outputs: body.outputs || [],
      pricing: body.pricing || { model: 'freemium' },
      requirements: body.requirements || {},
      security: body.security || { sandbox: true, isolationLevel: 'medium' },
      stats: body.stats || { usageCount: 0, successRate: 0, avgExecutionTime: 0, uptime: 0 },
      author: body.author || { name: 'Unknown', verified: false },
      rating: body.rating || 0,
      installs: body.installs || 0,
      health: body.health || 100,
      lastUpdated: new Date().toISOString(),
      isVerified: body.isVerified ?? false,
      isFeatured: body.isFeatured ?? false,
    };

    // In production, save to database
    console.log('New agent registered:', newAgent.name);

    return NextResponse.json(
      { success: true, agent: newAgent },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
