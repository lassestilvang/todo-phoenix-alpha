# Daily Task Planner

A modern, professional daily task planner built with Next.js 16, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

### Core Features
- ✅ Lists management with custom colors and emojis
- ✅ Task CRUD operations with full properties
- ✅ Multiple views: Today, Next 7 Days, Upcoming, All
- ✅ Subtasks with full properties
- ✅ Labels with colors and emojis
- ✅ Change logging for all task modifications
- ✅ Priority levels (High, Medium, Low, None)
- ✅ Date and deadline scheduling
- ✅ Time estimates and actual time tracking
- ✅ Search functionality
- ✅ Overdue task highlighting
- ✅ Dark/Light theme support

### Advanced Features
- ✅ Task detail modal with history
- ⏳ Reminders system (in progress)
- ⏳ Attachments (in progress)
- ⏳ Time tracking timer (in progress)
- ⏳ Recurring tasks (in progress)
- ⏳ Natural language task entry (stretch)
- ⏳ Smart suggestions (stretch)

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Animations**: Framer Motion
- **Database**: SQLite (better-sqlite3)
- **Forms**: react-hook-form + zod
- **Date Handling**: date-fns
- **Icons**: lucide-react
- **Package Manager**: Bun
- **Testing**: Bun Test

## Getting Started

### Prerequisites
- Bun installed on your system

### Installation

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
bun run build
bun start
```

## Project Structure

```
todo-phoenix-alpha/
├── src/
│   ├── app/
│   │   ├── actions/          # Server actions
│   │   ├── (dashboard)/      # Dashboard routes
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Dashboard page
│   ├── components/
│   │   ├── layout/           # Layout components (Sidebar)
│   │   ├── tasks/            # Task-related components
│   │   ├── ui/               # shadcn/ui components
│   │   └── providers/        # Context providers
│   ├── lib/
│   │   ├── db/               # Database operations
│   │   ├── types/            # TypeScript types
│   │   └── utils.ts          # Utility functions
│   └── ...
├── data/                     # SQLite database (gitignored)
├── public/                   # Static assets
└── tests/                    # Test files
```

## Database Schema

The application uses SQLite with the following tables:

- `lists` - Task lists with colors and emojis
- `tasks` - Main tasks with all properties
- `subtasks` - Subtasks with full properties
- `labels` - Labels with colors and emojis
- `task_labels` - Many-to-many relationship between tasks and labels
- `subtask_labels` - Many-to-many relationship between subtasks and labels
- `task_changes` - Audit trail for task changes
- `subtask_changes` - Audit trail for subtask changes
- `reminders` - Task reminders
- `attachments` - Task attachments
- `time_entries` - Time tracking entries

## Usage

### Creating a Task
1. Click the "New Task" button
2. Fill in the task details (name, description, date, deadline, etc.)
3. Set priority, estimate, and labels
4. Click "Create Task"

### Managing Tasks
- **Complete**: Click the checkbox next to a task
- **Edit**: Click the edit button in the task menu
- **Delete**: Click the delete button in the task menu
- **View Details**: Double-click on a task card

### Using Views
- **Today**: Shows tasks scheduled for today
- **Next 7 Days**: Shows tasks for the next week
- **Upcoming**: Shows all future tasks
- **All**: Shows all tasks
- Toggle completed tasks visibility with the button

### Lists and Labels
- Create custom lists from the sidebar
- Create custom labels from the sidebar
- Filter tasks by list or label

## Development

### Running Tests

```bash
bun test
```

### Code Style

The project uses:
- TypeScript strict mode
- ESLint for linting
- Prettier for formatting (configured in .prettierrc)

## Future Enhancements

- [ ] Complete reminders system with notifications
- [ ] Attachments with file upload
- [ ] Time tracking timer with persistence
- [ ] Recurring task logic
- [ ] Natural language task entry
- [ ] Smart scheduling suggestions
- [ ] Drag and drop task reordering
- [ ] Keyboard shortcuts
- [ ] Export/Import functionality
- [ ] Mobile app version

## Deployment

### Docker

```bash
# Build the Docker image
docker build -t todo-phoenix-alpha .

# Run the container
docker run -p 3000:3000 -v $PWD/data:/app/data todo-phoenix-alpha
```

### Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run tests
bun test

# Run lint
bun run lint
```

### Environment Variables

Create a `.env` file with:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Backup & Export

### Export Database as JSON

```bash
# Via API endpoint or manually trigger
exportDatabaseAsJson()
```

This will create a backup file in `data/backups/` with format `backup-YYYYMMDD-HHMMSS.db` and record it in the `db_backups` table.

### Restore from Backup

```bash
# Copy the backup file to the data directory
cp /path/to/backup-file.db data/backups/

# The application will automatically detect and use the latest backup
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
