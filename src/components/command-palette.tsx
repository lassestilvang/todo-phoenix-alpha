"use client";

import { useState, useCallback, useEffect, ChangeEvent } from "react";
import { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { X, Calendar, Clock, List as ListIcon, Plus, Trash2, Zap, Settings, Search, LayoutGrid, FileText, Server } from "lucide-react";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { toast } from "sonner";

// Helper to get SVG component
const getSvgIcon = (iconName: string) => {
  const icons: Record<string, React.JSX.Element> = {
    X: <X className="h-4 w-4" />,
    Calendar: <Calendar className="h-4 w-4" />,
    Clock: <Clock className="h-4 w-4" />,
    List: <ListIcon className="h-4 w-4" />,
    Plus: <Plus className="h-4 w-4" />,
    Trash2: <Trash2 className="h-4 w-4" />,
    Zap: <Zap className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
    Search: <Search className="h-4 w-4" />,
    LayoutGrid: <LayoutGrid className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Server: <Server className="h-4 w-4" />,
  };
  return icons[iconName] || <Settings className="h-4 w-4" />;
};

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    shortcut?: string;
    action: () => void;
  }>>([]);

  // Sample commands
  const commands = [
    {
      id: "new_task",
      name: "New Task",
      description: "Create a new task",
      icon: "Plus",
      shortcut: "Ctrl+N",
      action: () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('open-task-form'));
      },
    },
    {
      id: "search_tasks",
      name: "Search Tasks",
      description: "Search through your tasks",
      icon: "Search",
      shortcut: "Ctrl+F",
      action: () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('focus-task-search'));
      },
    },
    {
      id: "today_view",
      name: "Today View",
      description: "Show tasks for today",
      icon: "Calendar",
      action: () => {
        setIsOpen(false);
        router.push("/", { scroll: false });
      },
    },
    {
      id: "next_7_days",
      name: "Next 7 Days",
      description: "Show tasks for the next week",
      icon: "Calendar",
      action: () => {
        setIsOpen(false);
        router.push("/?view=next_7_days", { scroll: false });
      },
    },
    {
      id: "upcoming_view",
      name: "Upcoming Tasks",
      description: "Show upcoming tasks",
      icon: "Clock",
      action: () => {
        setIsOpen(false);
        router.push("/?view=upcoming", { scroll: false });
      },
    },
    {
      id: "all_tasks",
      name: "All Tasks",
      description: "Show all tasks",
      icon: "List",
      action: () => {
        setIsOpen(false);
        router.push("/?view=all", { scroll: false });
      },
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "View productivity insights and analytics",
      icon: "LayoutGrid",
      action: () => {
        setIsOpen(false);
        router.push("/analytics", { scroll: false });
      },
    },
    {
      id: "settings",
      name: "Settings",
      description: "Open application settings",
      icon: "Settings",
      action: () => {
        setIsOpen(false);
        toast.info("Settings panel coming soon");
      },
    },
    {
      id: "logout",
      name: "Logout",
      description: "Sign out of your account",
      icon: "Server",
      action: () => {
        setIsOpen(false);
        toast.info("Logout functionality would go here");
      },
    },
  ];

  // Handle search and filtering
  const handleInputChange = useCallback((query: string) => {
    const trimmed = query.toLowerCase().trim();

    if (!query) {
      setResults(commands);
      return;
    }

    const filtered = commands.filter(cmd =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.id.toLowerCase().includes(query)
    );

    setResults(filtered);
  }, []);

  // Initialize with all commands
  useEffect(() => {
    setResults(commands);
  }, []);

  // Close on escape
  useKeyboardShortcuts(
    {
      "escape": () => setIsOpen(false),
    },
    { enabled: isOpen, preventDefault: true }
  );

  // Open with Cmd+K
  useKeyboardShortcuts(
    {
      "cmd+k": () => {
        setIsOpen(true);
        // Focus the input when opened
        setTimeout(() => {
          const input = document.querySelector('[data-slot="command-input"]') as HTMLInputElement | null;
          if (input) input.focus();
        }, 100);
      },
    },
    { enabled: true, preventDefault: true }
  );

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Command Palette"
      description="Search for a command to run..."
    >
      <CommandInput
        onValueChange={(value) => handleInputChange(value)}
        placeholder="Search commands..."
        autoFocus
      />
      <CommandList>
        {results.length > 0 ? (
          <>
            <CommandGroup>
              {results.map((command) => (
                <CommandItem key={command.id} onSelect={command.action}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 text-foreground/60 shrink-0">
                      {getSvgIcon(command.icon)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium">{command.name}</div>
                      <div className="text-xs text-muted-foreground">{command.description}</div>
                    </div>
                    {command.shortcut && (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : (
          <CommandEmpty>
            No commands found. Try a different search.
          </CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  );
}