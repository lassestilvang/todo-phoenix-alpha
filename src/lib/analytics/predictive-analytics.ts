import { taskOperations } from '@/lib/db/tasks';
import { TaskWithDetails } from '@/lib/types';

/**
 * Predictive Analytics Engine - Forecasts task durations and completion times
 * using historical data modeling and machine learning patterns
 */
export interface DurationPrediction {
  taskId: number;
  predictedMinutes: number;
  confidence: number; // 0-1 scale, higher is more confident
  methodology: 'historical-average' | 'pattern-matching' | 'hybrid';
  factors: DurationPredictionFactor[];
  predictedCompletionDate: string | null;
}

export interface DurationPredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number; // -1 to 1 scale
  description: string;
}

export interface TaskDurationForecast {
  taskId: number;
  name: string;
  currentEstimate: number | null;
  predictedDuration: number;
  improvementOpportunity: number; // percentage improvement potential
  riskFactors: string[];
  recommendedActions: string[];
}

/**
 * Predict task duration based on historical data and patterns
 */
export class PredictiveAnalytics {
  /**
   * Get duration prediction for a single task
   */
  async getDurationPrediction(
    taskId: number,
    userId?: string
  ): Promise<DurationPrediction> {
    const task = await taskOperations.getById(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Gather historical data for this task type/pattern
    const historicalTasks = await this.getHistoricalSimilarTasks(task, userId);

    // Build prediction using hybrid approach
    const prediction = this.buildPrediction(task, historicalTasks);

    return {
      taskId,
      predictedMinutes: prediction.predictedMinutes,
      confidence: prediction.confidence,
      methodology: prediction.methodology,
      factors: prediction.factors,
      predictedCompletionDate: this.calculateCompletionDate(
        prediction.predictedMinutes,
        task.deadline
      )
    };
  }

  /**
   * Get duration forecasts for multiple tasks
   */
  async getTaskDurationForecasts(
    taskIds: number[],
    userId?: string
  ): Promise<TaskDurationForecast[]> {
    const forecasts: TaskDurationForecast[] = [];

    for (const taskId of taskIds) {
      const task = await taskOperations.getById(taskId);
      if (!task) continue;

      const prediction = await this.getDurationPrediction(taskId, userId);
      const forecast = this.createForecast(task, prediction);

      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Get historical similar tasks for pattern matching
   */
  private async getHistoricalSimilarTasks(
    task: TaskWithDetails,
    userId?: string
  ): Promise<TaskWithDetails[]> {
    // Get all completed tasks with actual durations
    const allTasks = await taskOperations.getAll(true) as TaskWithDetails[];

    // Filter tasks that are similar in nature
    const similarTasks = allTasks.filter(t => {
      // Same priority level
      if (t.priority !== task.priority) return false;

      // Similar estimated duration (within 50%)
      const currentEstimate = task.estimate_minutes || 0;
      const historicalEstimate = t.estimate_minutes || 0;

      if (currentEstimate > 0 && historicalEstimate > 0) {
        const ratio = Math.max(currentEstimate, historicalEstimate) / Math.min(currentEstimate, historicalEstimate);
        if (ratio > 1.5) return false; // Too different in scope
      }

      // Check for similar keywords in name/description
      const taskText = (task.name + ' ' + (task.description || '')).toLowerCase();
      const historicalText = (t.name + ' ' + (t.description || '')).toLowerCase();

      const similarKeywords = this.countSimilarKeywords(taskText, historicalText);
      if (similarKeywords < 2) return false; // Need at least 2 matching keywords

      return true;
    });

    // Sort by most recent completion
    return similarTasks
      .sort((a, b) => new Date(b.completed_at || b.updated_at).getTime() - new Date(a.completed_at || a.updated_at).getTime())
      .slice(0, 20);
  }

  /**
   * Count similar keywords between two texts
   */
  private countSimilarKeywords(text1: string, text2: string): number {
    const commonKeywords = [
      'design', 'code', 'test', 'debug', 'meeting', 'research', 'write',
      'document', 'review', 'plan', 'implement', 'fix', 'deploy'
    ];

    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    let count = 0;
    commonKeywords.forEach(keyword => {
      if (words1.has(keyword) && words2.has(keyword)) {
        count++;
      }
    });

    return count;
  }

  /**
   * Build duration prediction using hybrid approach
   */
  private buildPrediction(
    task: TaskWithDetails,
    historicalTasks: TaskWithDetails[]
  ): {
    predictedMinutes: number;
    confidence: number;
    methodology: string;
    factors: DurationPredictionFactor[];
  } {
    const factors: DurationPredictionFactor[] = [];
    let baseMinutes = 0;
    let confidenceSum = 0;

    // Factor 1: Historical average (40% weight)
    if (historicalTasks.length > 0) {
      const avgHistoricalDuration = historicalTasks.reduce(
        (sum, t) => sum + (t.actual_minutes || t.estimate_minutes || 0),
        0
      ) / historicalTasks.length;

      baseMinutes += avgHistoricalDuration * 0.4;
      confidenceSum += 0.4;

      factors.push({
        name: 'Historical Average',
        impact: 'positive',
        magnitude: 0.4,
        description: `Based on ${historicalTasks.length} similar historical tasks`
      });
    } else {
      // No historical data, use baseline
      baseMinutes += 60 * 0.4; // 1 hour baseline
      confidenceSum += 0.2;
    }

    // Factor 2: Current estimate adjustment (30% weight)
    const currentEstimate = task.estimate_minutes || 0;
    if (currentEstimate > 0) {
      // Blend current estimate with historical data
      const blended = (currentEstimate * 0.6) + (baseMinutes * 0.4);
      baseMinutes = blended;
      confidenceSum += 0.3;

      factors.push({
        name: 'Current Estimate',
        impact: 'positive',
        magnitude: 0.3,
        description: `Adjusted from ${currentEstimate}min based on similar task patterns`
      });
    } else {
      // No current estimate, rely on historical
      confidenceSum += 0.1;
    }

    // Factor 3: Priority adjustment (15% weight)
    const priorityMultiplier = { high: 1.2, medium: 1.0, low: 0.8, none: 0.9 }[task.priority] || 1.0;
    baseMinutes *= priorityMultiplier;

    factors.push({
      name: 'Priority Adjustment',
      impact: 'neutral',
      magnitude: 0.15,
      description: `${task.priority} priority multiplier: ${priorityMultiplier}x`
    });

    // Factor 4: Complexity modifier (15% weight)
    const complexityScore = this.calculateComplexityScore(task);
    const complexityModifier = 1 + (complexityScore - 0.5) * 0.4; // -20% to +20%
    baseMinutes *= complexityModifier;

    factors.push({
      name: 'Complexity Modifier',
      impact: 'neutral',
      magnitude: 0.15,
      description: `Complexity score: ${complexityScore.toFixed(2)}, ${complexityModifier.toFixed(2)}x multiplier`
    });

    // Calculate confidence based on data availability
    const confidence = Math.min(confidenceSum, 1);

    // Final predicted minutes, ensure minimum of 15 minutes
    const predictedMinutes = Math.max(baseMinutes, 15);

    const methodology = historicalTasks.length > 0 ? 'hybrid' : 'historical-average';

    return {
      predictedMinutes,
      confidence,
      methodology,
      factors
    };
  }

  /**
   * Calculate complexity score for a task (0-1 scale)
   */
  private calculateComplexityScore(task: TaskWithDetails): number {
    let score = 0.5; // Baseline

    // Priority contribution (0-0.3)
    const priorityScores: { [key: string]: number } = { high: 0.3, medium: 0.2, low: 0.1, none: 0 };
    score += priorityScores[task.priority] || 0;

    // Estimate contribution (0-0.2)
    const estimate = task.estimate_minutes || 0;
    if (estimate > 0) {
      score += Math.min(estimate / 600, 0.2); // Max 0.2 for 10+ hour tasks
    }

    // Dependency contribution (0-0.15)
    if (task.dependencies) {
      const depCount = (task.dependencies.match(/,/g) || '').length + 1;
      score += Math.min(depCount * 0.05, 0.15);
    }

    // Recurring task contribution (0-0.1)
    if (task.is_recurring) {
      score += 0.1;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Create a task duration forecast with recommendations
   */
  private createForecast(
    task: TaskWithDetails,
    prediction: DurationPrediction
  ): TaskDurationForecast {
    const improvementOpportunity = this.calculateImprovementOpportunity(task, prediction.predictedMinutes);
    const riskFactors = this.identifyRiskFactors(task);
    const recommendedActions = this.generateRecommendedActions(task, prediction);

    return {
      taskId: task.id,
      name: task.name,
      currentEstimate: task.estimate_minutes || null,
      predictedDuration: prediction.predictedMinutes,
      improvementOpportunity,
      riskFactors,
      recommendedActions
    };
  }

  /**
   * Calculate improvement opportunity percentage
   */
  private calculateImprovementOpportunity(
    task: TaskWithDetails,
    predictedMinutes: number
  ): number {
    const currentEstimate = task.estimate_minutes || 0;

    if (currentEstimate === 0) return 0;

    // If predicted is significantly less than current, there's improvement opportunity
    if (predictedMinutes < currentEstimate * 0.7) {
      return Math.round((1 - predictedMinutes / currentEstimate) * 100);
    }

    // If predicted is more than current, no improvement opportunity from estimation
    return 0;
  }

  /**
   * Identify risk factors for task completion
   */
  private identifyRiskFactors(task: TaskWithDetails): string[] {
    const risks: string[] = [];

    if (task.is_recurring && !task.recurring_pattern) {
      risks.push('Recurring task without pattern definition');
    }

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline < 24) {
        risks.push('Task is due within 24 hours');
      }
      if (hoursUntilDeadline < 0) {
        risks.push('Task is overdue');
      }
    }

    if (!task.description) {
      risks.push('No task description provided');
    }

    if (task.priority === 'high' && !task.dependencies) {
      risks.push('High priority task without identified dependencies');
    }

    return risks;
  }

  /**
   * Generate recommended actions based on analysis
   */
  private generateRecommendedActions(
    task: TaskWithDetails,
    prediction: DurationPrediction
  ): string[] {
    const actions: string[] = [];

    // Based on confidence level
    if (prediction.confidence < 0.5) {
      actions.push('Collect more historical data to improve prediction accuracy');
    }

    // Based on predicted vs current estimate
    if (prediction.predictedMinutes < task.estimate_minutes * 0.8 && task.estimate_minutes) {
      actions.push('Task may be over-estimated - consider breaking into smaller subtasks');
    }

    // Based on risk factors
    if (task.is_recurring && !task.recurring_pattern) {
      actions.push('Define recurring pattern for consistent duration tracking');
    }

    // Based on priority
    if (task.priority === 'high') {
      actions.push('High priority task - ensure adequate time allocation and remove blockers');
    }

    // General recommendation
    actions.push('Track actual duration for future prediction improvement');

    return actions;
  }

  /**
   * Calculate predicted completion date
   */
  private calculateCompletionDate(
    predictedMinutes: number,
    deadline: string | null
): string | null {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const predictedHours = predictedMinutes / 60;

    // If task starts now, when would it be completed?
    const completionDate = new Date(now.getTime() + predictedHours * 60 * 60 * 1000);

    // Format as ISO string date only
    const formatted = new Date(completionDate);
    formatted.setHours(0, 0, 0, 0);

    // Return null if completion would be far beyond deadline
    const deadlineOnly = new Date(deadline);
    deadlineOnly.setHours(0, 0, 0, 0);

    if (formatted.getTime() > deadlineOnly.getTime() * 1.5) {
      // More than 50% beyond deadline - return null to indicate risk
      return null;
    }

    return formatted.toISOString().split('T')[0];
  }
}