import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateTaskSuggestions(
  task: Partial<{ priority: string; estimate_minutes: number; date: Date }>
): Promise<{
  priority: 'high' | 'medium' | 'low' | 'none';
  suggestedTimeEstimate: number;
  suggestedDate: Date | null;
  relatedTasks: number[];
  confidence: number;
  predictiveSchedule?: {
    startDate: Date;
    optimalStartTime: string;
    confidence: number;
  };
}> {
  const prompt = `\n  Given this task: ${JSON.stringify(task)}\n\n  Please provide AI suggestions for:\n  1. Optimal priority level (high/medium/low/none)\n  2. Better time estimate in minutes\n  3. Suggested date (if not provided)\n  4. Related tasks (list of IDs)\n  5. Confidence score (0-100)\n  6. Predictive schedule recommendations:\n     - Optimal start date (considering task dependencies, time of day, user habits)\n     - Recommended time of day (morning/evening/preferred time)\n     - Confidence in the prediction\n\n  Consider the task's deadline, estimate, existing tasks with similar properties,\n  and scheduling patterns to provide the best recommendations.\n\n  Respond with JSON in this format:\n  {\n    "priority": "high|medium|low|none",\n    "suggestedTimeEstimate": 60,\n    "suggestedDate": "2024-01-15",\n    "relatedTasks": [1, 3, 5],\n    "confidence": 85,\n    "predictiveSchedule": {\n      "startDate": "2024-01-12",\n      "optimalStartTime": "09:00",\n      "confidence": 90\n    }\n  }\n  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.3,
      system: 'You are an AI assistant specialized in task optimization and productivity suggestions.',
      messages: [
        {
          type: 'user',
          content: prompt,
        },
      ],
    });

    const result = response.content[0]?.text;
    if (!result) {
      throw new Error('No response from Claude API');
    }

    // Parse JSON from Claude's response
    const jsonMatch = result.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    return JSON.parse(jsonMatch[0]) as any;

  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    // Return fallback suggestions with predictive scheduling
    const fallbackResult = {
      priority: task.priority || 'medium',
      suggestedTimeEstimate: task.estimate_minutes || 30,
      suggestedDate: null,
      relatedTasks: [],
      confidence: 30,
      predictiveSchedule: calculatePredictiveFallback(task),
    };
    return fallbackResult;
  }
}

/**
 * Calculate predictive schedule using simple heuristics when AI is unavailable
 */
function calculatePredictiveFallback(task: Partial<{ priority: string; estimate_minutes: number; date: Date }>): {
  startDate: Date;
  optimalStartTime: string;
  confidence: number;
} {
  const now = new Date();
  const estimateMinutes = task.estimate_minutes || 30;

  // Determine start date based on priority and deadline
  let startDate = new Date(now);
  if (task.date) {
    // If deadline is very soon, schedule it for today
    const deadline = new Date(task.date);
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      startDate = new Date(now);
    } else if (diffDays <= 7) {
      // Spread the workload over the next few days
      startDate = new Date(now.getTime() + (diffDays * 24 * 60 * 60 * 1000) / 3);
    } else {
      // Schedule for next week
      startDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  }

  // Optimal start time: morning (9am) for high priority, afternoon (2pm) otherwise
  const optimalTime = task.priority === 'high' ? '09:00' : '14:00';

  // Set the time on startDate
  const [hours, minutes] = optimalTime.split(':').map(Number);
  startDate.setHours(hours, minutes, 0, 0);

  // Confidence based on how specific the input is
  const hasDeadline = !!task.date;
  const hasEstimate = !!task.estimate_minutes;
  const confidence = hasDeadline && hasEstimate ? 75 : hasDeadline ? 55 : hasEstimate ? 50 : 30;

  return {
    startDate,
    optimalStartTime: optimalTime,
    confidence,
  };
}

/**
 * Generate insights about task patterns and behavior
 */
export async function generateInsights(userData: {
  tasks: any[];
  completedTasks: number;
  overdueTasks: number;
}): Promise<{
  mostProductiveTimeOfDay: number;
  commonTaskDuration: number;
  taskCompletionRate: number;
}> {
  const prompt = `\n  Given user task and productivity data:
  ${JSON.stringify(userData)}

  Provide insights on:
  1. Most productive time of day (hour 0-23)
  2. Common task duration in minutes
  3. Task completion rate percentage

  Respond with JSON in this format:
  {
    "mostProductiveTimeOfDay": 14,
    "commonTaskDuration": 45,
    "taskCompletionRate": 85
  }
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.2,
      system: 'You are an AI assistant specialized in analyzing productivity data.',
      messages: [
        {
          type: 'user',
          content: prompt,
        },
      ],
    });

    const result = response.content[0]?.text;
    if (!result) {
      throw new Error('No response from Claude API');
    }

    // Parse JSON from Claude's response
    const jsonMatch = result.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    return JSON.parse(jsonMatch[0]) as any;

  } catch (error) {
    console.error('Error generating insights:', error);
    return {
      mostProductiveTimeOfDay: 14,
      commonTaskDuration: 45,
      taskCompletionRate: 85,
    };
  }
}