# API Documentation - Todo Phoenix Alpha

## Overview

This document provides comprehensive API documentation for the Todo Phoenix Alpha application. The API provides endpoints for task management, collaboration, AI services, and conflict resolution.

## Base URL

All API endpoints are relative to your application base URL. For example: `https://your-domain.com/api`

## Authentication

Most endpoints require API key authentication via the `Authorization` header:

```
Authorization: Bearer your-api-key-here
```

Some public endpoints do not require authentication.

## Tasks API

### Create Task

**POST** `/api/tasks`

Creates a new task.

**Request Body:**

```json
{
  "name": "Task Name",
  "description": "Task description",
  "deadline": "2024-12-31T23:59:59Z",
  "priority": "high",
  "estimate_minutes": 60,
  "list_id": 1,
  "subtask_ids": [],
  "dependency_ids": []
}
```

**Response:**

```json
{
  "success": true,
  "task": {
    "id": 123,
    "name": "Task Name",
    "description": "Task description",
    "deadline": "2024-12-31T23:59:59Z",
    "priority": "high",
    "estimate_minutes": 60,
    "list_id": 1,
    "status": "pending",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### Get Tasks

**GET** `/api/tasks?status=pending&list_id=1&page=1&limit=20`

Retrieves a list of tasks with optional filtering.

**Query Parameters:**

- `status`: Task status (pending, in_progress, completed, cancelled)
- `list_id`: Filter by list ID
- `page`: Page number for pagination
- `limit`: Number of results per page

**Response:**

```json
{
  "success": true,
  "tasks": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Update Task

**PUT** `/api/tasks/123`

Updates an existing task.

**Request Body:**

```json
{
  "name": "Updated Task Name",
  "description": "Updated description",
  "deadline": "2024-12-31T23:59:59Z",
  "priority": "medium",
  "estimate_minutes": 90,
  "list_id": 1,
  "is_completed": false
}
```

### Delete Task

**DELETE** `/api/tasks/123`

Deletes a task.

### Subtasks

**POST** `/api/tasks/{taskId}/subtasks`

Creates a subtask for a task.

**GET** `/api/tasks/{taskId}/subtasks`

Retrieves all subtasks for a task.

### Task Dependencies

**POST** `/api/tasks/{taskId}/dependencies`

Adds a dependency between two tasks.

**DELETE** `/api/tasks/{taskId}/dependencies/{dependencyId}`

Removes a task dependency.

## Lists API

### Get Lists

**GET** `/api/lists`

Retrieves all task lists.

### Create List

**POST** `/api/lists`

Creates a new task list.

**Request Body:**

```json
{
  "name": "List Name",
  "color": "#6366f1",
  "emoji": "📋",
  "icon": "List"
}
```

## Attachments

### Upload Attachment

**POST** `/api/tasks/{taskId}/attachments`

Uploads a file attachment to a task.

**Request Body:**

Multipart/form-data with the file and metadata.

### Get Attachments

**GET** `/api/tasks/{taskId}/attachments`

Retrieves all attachments for a task.

### Download Attachment

**GET** `/api/tasks/{taskId}/attachments/{attachmentId}/download`

Downloads an attachment file.

## AI Services API

### Task Decomposition

**POST** `/api/ai/decompose`

Decomposes a complex task into sub-tasks using AI.

**Request Body:**

```json
{
  "task_name": "Create a marketing website",
  "description": "A comprehensive website for a marketing company",
  "priority": "high",
  "estimate_minutes": 480
}
```

**Response:**

```json
{
  "success": true,
  "subtasks": [
    {
      "name": "Set up development environment",
      "description": "Configure Git, Node.js, and project setup",
      "priority": "high",
      "estimated_minutes": 60
    },
    {
      "name": "Design website mockups",
      "description": "Create wireframes and UI designs",
      "priority": "medium",
      "estimated_minutes": 120
    }
  ]
}
```

### Natural Language Parser

**POST** `/api/ai/parse`

Parses natural language task descriptions.

**Request Body:**

```json
{
  "text": "Next Monday, create a report on Q4 sales performance"
}
```

**Response:**

```json
{
  "success": true,
  "parsed": {
    "task_name": "Create Q4 sales performance report",
    "deadline": "2024-01-15T09:00:00Z",
    "priority": "high",
    "tags": ["report", "sales", "Q4"]
  }
}
```

### Smart Suggestions

**GET** `/api/ai/suggestions?priority=high&context=tasks_created_today`

Get smart task suggestions based on user behavior and context.

### Voice Commands

**POST** `/api/voice/tasks`

Processes voice commands for task management.

**Request Body:**

```json
{
  "command": "Create a task called project meeting for tomorrow at 2pm",
  "user_id": "user123"
}
```

## Collaboration API

### Collaboration Sessions

**POST** `/api/collaboration/sessions`

Creates a new collaboration session (brainstorm, review, planning).

**GET** `/api/collaboration/sessions/{sessionId}/ideas`

Retrieves all brainstorm ideas for a session.

**POST** `/api/collaboration/sessions/{sessionId}/ideas`

Adds an idea to a collaboration session.

**POST** `/api/collaboration/sessions/{sessionId}/comments`

Adds a comment to a collaboration session.

## Analytics API

### Productivity Dashboard

**GET** `/api/analytics/dashboard?user_id=default`

Retrieves productivity dashboard data with analytics.

### Task Statistics

**GET** `/api/analytics/stats/tasks?start_date=2024-01-01&end_date=2024-12-31`

Retrieves task statistics over a time period.

### AI Enhancement

**POST** `/api/ai/enhancement`

Enhances task descriptions using AI.

**Request Body:**

```json
{
  "task_id": 123,
  "enhancement_type": "priority_suggestion"
}
```

## Conflict Resolution API

### Active Conflicts

**GET** `/api/conflicts?action=active`

Retrieves all active conflicts.

**Response:**

```json
{
  "success": true,
  "conflicts": [
    {
      "id": "conflict-123",
      "type": "TASK_LOCK_CONTENTION",
      "participants": ["agent-A", "agent-B"],
      "description": "Sample task conflict",
      "priority": 5,
      "severity": "medium",
      "context": { "taskId": "123", "timestamp": 1704067200000 }
    }
  ],
  "count": 1
}
```

### Conflict Resolution

**POST** `/api/conflicts`

Resolves a conflict using various strategies.

**Request Body:**

```json
{
  "action": "resolve",
  "conflictId": "conflict-123",
  "strategy": "LOCK_WINNER"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Conflict resolved",
  "resolution": {
    "strategy": "LOCK_WINNER",
    "winner": "agent-A",
    "outcome": "success"
  }
}
```

### Conflict Reports

**POST** `/api/conflicts`

Reports a new conflict.

**Request Body:**

```json
{
  "action": "report",
  "type": "TASK_LOCK_CONTENTION",
  "participants": ["agent-A", "agent-B"],
  "description": "Task conflict over resource",
  "priority": 7,
  "severity": "high",
  "context": { "taskId": "123", "timestamp": 1704067200000 }
}
```

## Intelligence Hub API

### Workflow Execution

**POST** `/api/workflows/execute`

Executes an automated workflow.

### Pattern Mining

**GET** `/api/intelligence-hub/pattern-mining/status`

Gets status of pattern mining service.

### Agent Orchestration

**GET** `/api/intelligence-hub/agents`

Lists all active agents.

## Search API

### Search Tasks

**GET** `/api/search/tasks?q=search-term&filters={...}`

Searches tasks with advanced filtering.

**Query Parameters:**

- `q`: Search query string
- `filters`: JSON object with filter criteria

## WebSocket Endpoints

The application supports real-time updates via WebSocket connections for:

- Task creation and updates
- Conflict notifications
- Collaboration session updates
- AI enhancement completions

## Error Responses

All API responses follow this structure:

```json
{
  "success": boolean,
  "message": "Optional message",
  "error": "Error message if success is false",
  "data": {...} // Response data when success is true
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Standard endpoints: 100 requests per minute
- AI service endpoints: 20 requests per minute
- File upload endpoints: 10 requests per minute

## CORS

The API supports CORS for web applications with configurable origins.

## Versioning

The API is versioned. Current version: `v1`. Future versions will maintain backward compatibility.

## Testing

API endpoints include comprehensive test coverage:

- Unit tests for all endpoints
- Integration tests for end-to-end scenarios
- Authentication and authorization tests
- Error handling tests
- Performance tests

## Additional Resources

- [GitHub Repository](https://github.com/your-username/todo-phoenix-alpha)
- [API Roadmap](https://github.com/your-username/todo-phoenix-alpha/blob/main/ROADMAP.md)
- [Contributing Guide](https://github.com/your-username/todo-phoenix-alpha/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/your-username/todo-phoenix-alpha/blob/main/CHANGELOG.md)