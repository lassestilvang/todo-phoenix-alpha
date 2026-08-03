@AGENTS.md

# todo-phoenix-alpha - Feature Implementation Summary

## � ✅ Backup & Export System
- **Function**: `exportDatabaseAsJson()` in `src/app/actions/tasks.ts`
- **Usage**: Triggers database backup creation with timestamp-based filename
- **Storage**: Saves `.db` files in `data/backups/` directory and records entries in `db_backups` table
- **Restore**: Copy backup file from any source to `data/backups/` directory
- **Security**: Backups include checksum verification and metadata

## � ✅ Attachment Management
- **Capacity**: Increased limit from 5 to 10 attachments per task
- **Upload Process**: 
  - File selection via standard input in TaskFormDialog
  - Automatic Base64 encoding for storage
  - Progress indication during upload
- **Preview System**:
  - Attachments displayed as Badges in TaskDetailModal
  - Click-to-download functionality for all file types
  - File type and size information shown
- **Validation**: 10MB maximum file size enforced

## � ✅ Reminders & Notifications
- **Creation**: `createReminder(taskId, reminderTime)` function
- **Checking**: Automated background checking every 30 seconds
- **UI**: Toast notifications with task details and action buttons
- **Persistence**: Reminders stored in database with sent status tracking
- **Integration**: Works with natural language time parsing

## � ✅ Keyboard Shortcuts System
- **Global Shortcuts**:
  - `Ctrl+N`: Create new task
  - `Escape`: Cancel current operation/close dialogs
- **Implementation**: Custom `useKeyboardShortcuts` hook
- **Safety**: Skips execution when typing in input fields
- **PreventDefault**: Optional parameter to prevent browser default actions
- **Extensibility**: Easy to add new shortcut combinations

## � ✅ Time Tracking Persistence
- **Mechanism**: `time_tracking_snapshots` table stores timer state
- **Features**:
  - Survives page refreshes and browser restarts
  - Accurate elapsed time calculation
  - Start/stop/pause functionality
  - Visual feedback in TaskDetailModal
- **Integration**: Works with existing time entry system

## � ✅ Database Enhancements
- **Indexes**: Performance-optimized indexes on frequently queried columns
- **Foreign Keys**: Enforced referential integrity
- **Defaults**: Automatic Inbox list creation on first run
- **Extensions**: Added recurring tasks, projects, and time tracking tables