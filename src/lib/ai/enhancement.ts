import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate AI suggestions for task optimization
 */
export async function generateTaskSuggestions(
  task: Partial<{ priority: string; estimate_minutes: number; date: Date }>
): Promise<{
  priority: 'high' | 'medium' | 'low' | 'none';
  suggestedTimeEstimate: number;
  suggestedDate: Date | null;
  relatedTasks: number[];
  confidence: number;
}> {
  const prompt = `
  Given this task: ${JSON.stringify(task)}

  Please provide AI suggestions for:
  1. Optimal priority level (high/medium/low/none)
  2. Better time estimate in minutes
  3. Suggested date (if not provided)
  4. Related tasks (list of IDs)
  5. Confidence score (0-100)

  Consider the task's deadline, estimate, existing tasks with similar properties,
  and scheduling patterns to provide the best recommendations.

  Respond with JSON in this format:
  {
    "priority": "high|medium|low|none",
    "suggestedTimeEstimate": 60,
    "suggestedDate": "2024-01-15",
    "relatedTasks": [1, 3, 5],
    "confidence": 85
  }
  `;

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
    // Return fallback suggestions
    return {
      priority: task.priority || 'medium',
      suggestedTimeEstimate: task.estimate_minutes || 30,
      suggestedDate: null,
      relatedTasks: [],
      confidence: 30,
    };
  }
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
  const prompt = `
  Given user task and productivity data:
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