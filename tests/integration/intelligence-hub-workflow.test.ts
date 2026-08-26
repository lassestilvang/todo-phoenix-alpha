import { WorkflowManager, WorkflowStep } from '@/lib/intelligence-hub/workflow-manager';
import { IntelligenceHub } from '@/lib/intelligence-hub';
import { TaskWithDetails, Task } from '@/lib/types';

describe('Intelligence Hub Workflow Integration', () => {
  let workflowManager: WorkflowManager;
  let intelligenceHub: IntelligenceHub;

  beforeEach(() => {
    workflowManager = new WorkflowManager();
    intelligenceHub = new IntelligenceHub();
  });

  describe('createCompletionWorkflow', () => {
    it('should create a completion workflow with all steps', async () => {
      const result = await workflowManager.createCompletionWorkflow(1, 'user-123');

      expect(result.workflowId).toBeDefined();
      expect(result.steps).toHaveLength(5);
      expect(result.status).toBe('pending');

      // Verify step structure
      expect(result.steps[0].id).toBe('step-1');
      expect(result.steps[0].name).toBe('Task Completion Verification');
      expect(result.steps[0].type).toBe('verification');
      expect(result.steps[0].action).toBe('verifyTaskCompletion');

      expect(result.steps[1].id).toBe('step-2');
      expect(result.steps[1].name).toBe('Update Task Status');
      expect(result.steps[1].type).toBe('status-update');
      expect(result.steps[1].action).toBe('markTaskCompleted');

      expect(result.steps[2].id).toBe('step-3');
      expect(result.steps[2].name).toBe('Notify Stakeholders');
      expect(result.steps[2].type).toBe('notification');
      expect(result.steps[2].action).toBe('sendCompletionNotification');

      expect(result.steps[3].id).toBe('step-4');
      expect(result.steps[3].name).toBe('Award Points/Badges');
      expect(result.steps[3].type).toBe('gamification');
      expect(result.steps[3].action).toBe('awardRecognition');

      expect(result.steps[4].id).toBe('step-5');
      expect(result.steps[4].name).toBe('Post-Review Analysis');
      expect(result.steps[4].type).toBe('analysis');
      expect(result.steps[4].action).toBe('postTaskReview');
    });

    it('should set proper dependencies between steps', async () => {
      const result = await workflowManager.createCompletionWorkflow(1, 'user-123');

      // step-2 depends on step-1
      expect(result.steps[1].dependsOn).toContain('step-1');
      // step-3 depends on step-2
      expect(result.steps[2].dependsOn).toContain('step-2');
      // step-4 depends on step-3
      expect(result.steps[3].dependsOn).toContain('step-3');
      // step-5 depends on step-4
      expect(result.steps[4].dependsOn).toContain('step-4');
    });

    it('should set proper due dates for each step', async () => {
      const result = await workflowManager.createCompletionWorkflow(1, 'user-123');

      // step-1: 24 hours from now
      const step1Date = new Date(result.steps[0].dueDate);
      const now = new Date();
      const diff1 = step1Date.getTime() - now.getTime();
      expect(diff1).toBeCloseTo(24 * 60 * 60 * 1000, -1); // within 1 minute

      // step-2: 24 hours from now (depends on step-1)
      const step2Date = new Date(result.steps[1].dueDate);
      const diff2 = step2Date.getTime() - now.getTime();
      expect(diff2).toBeCloseTo(24 * 60 * 60 * 1000, -1);

      // step-3: 12 hours from now (depends on step-2)
      const step3Date = new Date(result.steps[2].dueDate);
      const diff3 = step3Date.getTime() - now.getTime();
      expect(diff3).toBeCloseTo(12 * 60 * 60 * 1000, -1);

      // step-4: 6 hours from now (depends on step-3)
      const step4Date = new Date(result.steps[3].dueDate);
      const diff4 = step4Date.getTime() - now.getTime();
      expect(diff4).toBeCloseTo(6 * 60 * 60 * 1000, -1);

      // step-5: 48 hours from now (depends on step-4)
      const step5Date = new Date(result.steps[4].dueDate);
      const diff5 = step5Date.getTime() - now.getTime();
      expect(diff5).toBeCloseTo(48 * 60 * 60 * 1000, -1);
    });
  });

  describe('executeStep', () => {
    it('should execute verifyTaskCompletion step', async () => {
      const workflowResult = await workflowManager.createCompletionWorkflow(1, 'user-123');
      const result = await workflowManager.executeStep(
        workflowResult.workflowId,
        'step-1',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Task completion verified');

      // Verify step status was updated
      const workflow = workflowResult.steps.map(s => ({
        id: s.id,
        status: s.status
      }));
      const step1 = workflow.find(s => s.id === 'step-1');
      expect(step1?.status).toBe('completed');
    });

    it('should handle already completed task', async () => {
      // Create workflow for task that's already completed
      const workflowResult = await workflowManager.createCompletionWorkflow(999, 'user-123');
      const result = await workflowManager.executeStep(
        workflowResult.workflowId,
        'step-1',
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Task already marked as completed');
    });

    it('should fail for non-existent workflow', async () => {
      const result = await workflowManager.executeStep('nonexistent-workflow', 'step-1', 'user-123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('workflow registry', () => {
    it('should save workflow to registry', async () => {
      const result = await workflowManager.createCompletionWorkflow(1, 'user-123');
      expect(workflowManager['workflowRegistry'].has(result.workflowId)).toBe(true);
    });

    it('should retrieve saved workflow from registry', async () => {
      const createResult = await workflowManager.createCompletionWorkflow(1, 'user-123');
      const saved = workflowManager['workflowRegistry'].get(createResult.workflowId);

      expect(saved).toBeDefined();
      expect(saved?.workflowId).toBe(createResult.workflowId);
      expect(saved?.steps).toHaveLength(5);
    });

    it('should update workflow status in registry', async () => {
      const createResult = await workflowManager.createCompletionWorkflow(1, 'user-123');
      await workflowManager.executeStep(
        createResult.workflowId,
        'step-1',
        'user-123'
      );

      const saved = workflowManager['workflowRegistry'].get(createResult.workflowId);
      const step1 = saved?.steps.find(s => s.id === 'step-1');
      expect(step1?.status).toBe('completed');
    });
  });

  describe('integrated intelligence hub workflow', () => {
    it('should create task completion workflow via intelligence hub', async () => {
      const result = await intelligenceHub.createTaskCompletionWorkflow(1, 'user-123');

      expect(result.workflowId).toBeDefined();
      expect(result.steps).toHaveLength(5);
      expect(result.status).toBe('pending');
    });

    it('should execute step via intelligence hub', async () => {
      const createResult = await intelligenceHub.createTaskCompletionWorkflow(1, 'user-123');
      const result = await intelligenceHub.executeWorkflowStep(
        createResult.workflowId,
        'step-1',
        'user-123'
      );

      expect(result.success).toBe(true);
    });

    it('should predict task duration via intelligence hub', async () => {
      const result = await intelligenceHub.predictTaskDuration(1);

      expect(result.predictedMinutes).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
    });

    it('should get predictive insights via intelligence hub', async () => {
      const result = await intelligenceHub.getPredictiveInsights([1, 2]);

      expect(result.predictions).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});