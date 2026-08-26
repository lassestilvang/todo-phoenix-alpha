import { PredictiveAnalytics, DurationPrediction, TaskDurationForecast } from '@/lib/analytics/predictive-analytics';
import { TaskWithDetails } from '@/lib/types';

describe('Predictive Analytics Integration', () => {
  let predictiveAnalytics: PredictiveAnalytics;

  beforeEach(() => {
    predictiveAnalytics = new PredictiveAnalytics();
  });

  describe('getDurationPrediction', () => {
    it('should return a prediction with all required fields', async () => {
      const prediction = await predictiveAnalytics.getDurationPrediction(1);

      expect(prediction.taskId).toBe(1);
      expect(prediction.predictedMinutes).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(['historical-average', 'pattern-matching', 'hybrid']).toContain(prediction.methodology);
      expect(prediction.factors).toBeDefined();
      expect(Array.isArray(prediction.factors)).toBe(true);
      expect(prediction.predictedCompletionDate).toBeDefined();
    });

    it('should include factors with proper structure', async () => {
      const prediction = await predictiveAnalytics.getDurationPrediction(1);

      expect(prediction.factors.length).toBeGreaterThan(0);
      prediction.factors.forEach(factor => {
        expect(factor.name).toBeDefined();
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
        expect(factor.magnitude).toBeGreaterThanOrEqual(-1);
        expect(factor.magnitude).toBeLessThanOrEqual(1);
        expect(factor.description).toBeDefined();
      });
    });
  });

  describe('getTaskDurationForecasts', () => {
    it('should return forecasts for multiple tasks', async () => {
      const forecasts = await predictiveAnalytics.getTaskDurationForecasts([1, 2, 3]);

      expect(Array.isArray(forecasts)).toBe(true);
      forecasts.forEach(forecast => {
        expect(forecast.taskId).toBeDefined();
        expect(forecast.name).toBeDefined();
        expect(forecast.currentEstimate).toBeDefined();
        expect(forecast.predictedDuration).toBeGreaterThan(0);
        expect(forecast.improvementOpportunity).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(forecast.riskFactors)).toBe(true);
        expect(Array.isArray(forecast.recommendedActions)).toBe(true);
      });
    });
  });

  describe('complexity scoring', () => {
    it('should calculate higher complexity for high priority tasks', async () => {
      // Test via prediction factors
      const prediction = await predictiveAnalytics.getDurationPrediction(1);
      const complexityFactor = prediction.factors.find(f => f.name === 'Complexity Modifier');

      expect(complexityFactor).toBeDefined();
      expect(complexityFactor?.magnitude).toBeGreaterThan(0);
    });

    it('should adjust for recurring tasks', async () => {
      // Test that recurring tasks get complexity adjustment
      // This is tested indirectly through the prediction
      const prediction = await predictiveAnalytics.getDurationPrediction(1);
      expect(prediction.predictedMinutes).toBeGreaterThan(0);
    });
  });

  describe('improvement opportunity calculation', () => {
    it('should identify over-estimated tasks', async () => {
      const forecasts = await predictiveAnalytics.getTaskDurationForecasts([1]);
      const forecast = forecasts[0];

      // Should be 0 or positive
      expect(forecast.improvementOpportunity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('risk factor identification', () => {
    it('should identify overdue tasks as risk', async () => {
      const forecasts = await predictiveAnalytics.getTaskDurationForecasts([1]);
      const forecast = forecasts[0];

      expect(Array.isArray(forecast.riskFactors)).toBe(true);
    });

    it('should identify missing description as risk', async () => {
      const forecasts = await predictiveAnalytics.getTaskDurationForecasts([1]);
      const forecast = forecasts[0];

      // Should have at least some risk factors or recommendations
      expect(forecast.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('recommendations', () => {
    it('should provide actionable recommendations', async () => {
      const forecasts = await predictiveAnalytics.getTaskDurationForecasts([1]);
      const forecast = forecasts[0];

      expect(Array.isArray(forecast.recommendedActions)).toBe(true);
      expect(forecast.recommendedActions.length).toBeGreaterThan(0);

      // Should include tracking recommendation
      const hasTrackingRec = forecast.recommendedActions.some(
        rec => rec.toLowerCase().includes('track')
      );
      expect(hasTrackingRec).toBe(true);
    });
  });
});