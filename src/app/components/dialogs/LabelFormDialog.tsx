"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Tag as TagIcon } from "lucide-react";

interface LabelFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    color: string;
    emoji: string;
  }) => void;
  initialData?: {
    name: string;
    color: string;
    emoji: string;
  };
  mode?: "create" | "edit";
}

const COMMON_EGGS = [
  "🏷️",
  "✅",
  "❌",
  "⚠️",
  "💡",
  "🔥",
  "⚡",
  "🚀",
  "📅",
  "📌",
  "⭐",
  "📝",
  "🎯",
  "🧠",
  "⚙️",
  "🔄",
  "📊",
  "🔍",
  "🛠️",
  "📁",
];

export function LabelFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  mode = "create",
}: LabelFormDialogProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    color: initialData?.color || "#ec4899",
    emoji: initialData?.emoji || "🏷️",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.length > 30) {
      newErrors.name = "Name must be less than 30 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving label:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleEmojiChange = (emoji: string) => {
    setFormData((prev) => ({ ...prev, emoji }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Create New Label" : "Edit Label"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Label Name */}
            <div>
              <Label htmlFor="label-name">Name</Label>
              <Input
                id="label-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Enter label name"
                className={errors.name ? "border-red-500" : ""}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Emoji Selector */}
            <div>
              <Label className="mb-2">Emoji</Label>
              <div className="flex flex-wrap items-center gap-2 p-3 border border-input rounded-lg">
                <div className="flex flex-wrap gap-1">
                  {COMMON_EGGS.map((egg) => (
                    <button
                      key={egg}
                      type="button"
                      onClick={() => handleEmojiChange(egg)}
                      className={`text-xl transition-transform hover:scale-110 ${
                        formData.emoji === egg ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {egg}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground ml-auto">
                  Selected: <span className="text-lg">{formData.emoji}</span>
                </span>
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <Label>Color</Label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-12 h-12 p-1 border border-input rounded"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "create" ? (
                "Create Label"
              ) : (
                "Save Label"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}