# Phase 3: Advanced Scheduling & Deep AI Insights

## Overview
Extend todo-phoenix-alpha beyond basic task management into intelligent planning with:
- Task dependencies and critical path analysis
- Predictive scheduling based on user behavior
- Recurring pattern detection and optimization
- Performance scalability for larger datasets
- User-model personalization

---

## 1. Task Dependency Graph

### 1.1 Database Schema Migration
```sql
-- Add dependencies column to tasks table
ALTER TABLE tasks ADD COLUMN dependencies JSON DEFAULT '[]';

-- Indexes for performance
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_list_id ON tasks(list_id);
```

### 1.2 API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/tasks/:id/dependencies` | Add dependency |
| `DELETE /api/tasks/:id/dependencies/:depId` | Remove dependency |
| `GET /api/tasks/:id/dependencies` | List all dependencies |

### 1.3 Dependency Data Structure
```json
{
  "dependencies": [15, 23, 42]  // Array of task IDs this task depends on
}
```

### 1.4 UI Components
- **Dependency DAG Visualization**: Mermaid.js or D3.js diagram showing task relationships
- **Add Dependency Modal**: Search and select existing tasks as prerequisites
- **Critical Path Highlighting**: Visual indication of tasks on the critical path
- **Auto-reschedule Warning**: When moving a dependent task, warn about downstream effects

### 1.4 Implementation Priority: HIGH
- Core dependency management is essential for project planning
- Enables complex workflows (e.g., "Publish blog post" depends on "Write article" AND "Design graphics")

---

## 2. Predictive Scheduling

### 2.1 Core Idea
Use historical task completion data + AI suggestions to auto-assign optimal start dates.

### 2.2 Algorithm
1. **Analyze user's historical patterns**:
   - Average time from task creation to completion
   - Preferred deadlines (e.g., always sets tasks for Friday)
   - Completion rate by day of week

2. **AI-enhanced suggestion**:
   - Call `generateTaskSuggestions()` with deadline proximity logic
   - Add `scheduledStart` field based on:
     - User's typical lead time (e.g., "usually starts 2 days before deadline")
     - Current workload capacity
     - Day-of-week preferences

### 2.3 API Enhancement
Extend `generateTaskSuggestions` return type:
```typescript
interface AISuggestions {
  priority: string;
  estimatedMinutes: number;
  scheduledStart: Date | null;  // NEW
  relatedTasks: number[];
  confidence: number;
}
```

### 2.5 UI Integration
- **Auto-schedule toggle**: When enabled, start date is auto-computed
- **Manual override**: User can drag start date on calendar
- **Suggestion preview**: "AI suggests starting March 20 - you can adjust"

### 2.5 Implementation Priority: MEDIUM
- High value for power users
- Requires historical data accumulation (minimum 10 completed tasks)

---

## 3. Recurring Pattern Mining

### 3.1 Nightly Job (Cron: `0 2 * * 0`)
Runs weekly on Sunday at 2 AM to analyze completed tasks.

### 3.2 Analysis Steps
1. **Retrieve all completed tasks from last 90 days**
2. **Identify recurring patterns**:
   - Tasks completed on same day-of-week repeatedly
   - Tasks with similar duration patterns
   - Time-of-day completion clustering
3. **Generate suggestions**:
   - "You consistently complete admin tasks on Friday afternoons"
   - "Consider scheduling similar tasks for Tuesdays"
   - "Your average task duration is 45 minutes - block accordingly"

### 3.3 Output Format
```json
{
  "patterns": [
    {
      "type": "day_of_week",
      "day": "Friday",
      "confidence": 0.87,
      "suggested_slots": ["14:00-15:00", "15:00-16:00"]
    },
    {
      "type": "duration",
      "avg_minutes": 45,
      "recommended_block": "45min blocks with 15min breaks"
    }
  ],
  "recommendations": [
    "Block Friday afternoons for administrative work",
    "Use Pomodoro technique for tasks under 60 minutes"
  ]
}
```

### 3.3 UI Integration
- **Pattern badges** on dashboard: "You work best on Fridays"
- **Smart calendar suggestions**: "Based on your history, Friday 2-3pm is optimal"
- **Weekly insights email**: Summary of detected patterns

### 3.5 Implementation Priority: LOW-MEDIUM
- Requires 30+ days of data for meaningful patterns
- High value for long-term users
- Can be toggled on/off in settings

---

## 4. Performance Optimizations

### 4.1 Database Indexes (Already Planned)
- `idx_tasks_deadline` - filter by due date
- `idx_tasks_priority` - sort/filter by priority
- `idx_tasks_list_id` - query tasks per list
- `idx_recurring_schedules_next_run` - efficient recurring task generation

### 4.2 In-Memory Caching
- **lru-cache** for frequently accessed queries:
  - `getTasksForDate(date)` - TTL 30 seconds
  - `getUpcomingTasks(days)` - TTL 1 minute
  - `getProductivityInsights()` - TTL 5 minutes (expensive calculation)

### 4.3 Query Optimization
- Pagination for large task lists (limit 50, cursor-based)
- Select only needed columns (avoid `SELECT *`)
- Raw SQL for critical performance paths

### 4.3 Implementation Priority: MEDIUM
- Essential for production deployment with >1000 tasks
- Low implementation cost, high performance impact

---

## 5. User Model Personalization

### 5.1 Few-Shot Prompt Enhancement
Append user-specific examples to Claude system prompt:

```
Based on user's history:
- Typically sets deadlines 3 days before actual due date
- Prefers morning tasks (9am-12pm) for creative work
- Completes 80% of tasks within 48h of creation
- Uses Pomodoro technique for tasks > 60 minutes
```

### 5.2 Data Collection
- Log task creation timestamps, deadline settings, completion times
- Track which AI suggestions were accepted/rejected
- Store in `user_preferences` table (or extend existing metadata)

### 5.3 Implementation Priority: RESEARCH
- High potential value but requires careful A/B testing
- Start with simple heuristics, advance to ML models later
- Privacy-conscious data handling required

---

## 6. Migration & Rollout Plan

### 6.1 Phase 3a (Weeks 1-2)
- ✅ Add `dependencies` column to DB
- ✅ Build basic dependency CRUD API
- ✅ Add dependency DAG component (Mermaid.js)
- ✅ Deploy to staging

### 6.2 Phase 3b (Weeks 3-4)
- ✅ Implement predictive scheduling in `generateTaskSuggestions`
- ✅ Add auto-schedule toggle in UI
- ✅ Set up nightly recurring pattern job
- ✅ Add performance indexes

### 6.3 Phase 3c (Weeks 5-6)
- ✅ User preference collection framework
- ✅ Few-shot prompt enhancement (Phase 1: simple heuristics)
- ✅ Performance caching layer
- ✅ Beta launch with all Phase 3 features

### 6.4 Rollback Strategy
- Dependencies column defaults to `'[]'` (empty array) - fully backward compatible
- Caching can be disabled feature flag
- All API changes optional (feature flags)

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dependency graph adoption | 40% of power users create at least 1 dependency | Analytics event tracking |
| Predictive scheduling usage | 60% enable auto-schedule after 2 weeks | Feature flag data |
| Recurring pattern detection | 70% of users with 30+ days see at least 1 pattern | Nightly job output |
| Performance | 95th percentile page load < 500ms with 500 tasks | Lighthouse/benchmarks |
| User satisfaction | NPS increase of 10 points post-launch | Surveys/feedback |

---

## 8. Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Circular dependencies | Graph validation before save; error message "Cannot create circular dependency" |
| Performance degradation with large datasets | Pagination + caching; monitor query patterns; add indexes as needed |
| User privacy concerns | Opt-in data collection; anonymize storage; clear privacy policy |
| AI suggestion fatigue | Toggle in settings; only show after user has 10+ completed tasks |
| Circular prompt injection | Sanitize all user data appended to system prompts |

---

## 8. Next Immediate Actions

### Week 1 Priority:
1. **Add dependencies column migration** to database
2. **Build Dependency CRUD API endpoints** in `src/app/api/tasks/`
3. **Create Mermaid.js dependency DAG component** in dashboard
4. **Write unit tests** for dependency operations

### Week 2 Priority:
5. **Extend `generateTaskSuggestions`** with `scheduledStart` field
6. **Add auto-schedule toggle** in task creation/editing UI
7. **Set up cron job** for recurring pattern mining (`0 2 * * 0`)
8. **Add performance indexes** to SQLite schema

### Week 3 Priority:
9. **Implement user preference logging framework**
10. **Add few-shot prompt enhancement** (simple heuristics first)
11. **Performance benchmarking** and caching layer
12. **Beta launch** with select users

---

## 9. Development Checklist

- [ ] Add `dependencies` JSON column to `tasks` table migration
- [ ] Build API: `POST /api/tasks/:id/dependencies`
- [ ] Build API: `DELETE /api/tasks/:id/dependencies/:depId`
- [ ] Build API: `GET /api/tasks/:id/dependencies`
- [ ] Create Mermaid.js DAG visualization component
- [ ] Extend `generateTaskSuggestions` return type
- [ ] Add `scheduledStart` UI field in task form
- [ ] Set up nightly cron job for pattern mining
- [ ] Add SQLite indexes (deadline, priority, list_id)
- [ ] Implement lru-cache for query caching
- [ ] Write comprehensive test suite
- [ ] Update documentation with Phase 3 features
- [ ] Beta testing with power users
- [ ] Feature flag framework for gradual rollout

---

*Document version: 1.0*
*Created: 2026-08-16*
*Target completion: 3 weeks from start*