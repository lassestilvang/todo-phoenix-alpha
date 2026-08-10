"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';

const COMMON_EMOJIS = [
  '📋', '📝', '✅', '📌', '🏷️', '🔖', '📚', '📁',
  '📂', '🗂️', '🗃️', '🗄️', '📦', '🗑️', '🔒', '🔓',
  '⭐', '🌟', '💫', '✨', '🎯', '🏆', '🏷️', '📍'
];

interface ListFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    color: string;
    emoji: string;
    icon: string;
  }) => void;
  initialData?: {
    name: string;
    color: string;
    emoji: string;
    icon: string;
  };
  mode?: 'create' | 'edit';
}

const ICONS = [
  { value: 'List', label: 'List' },
  { value: 'Checklist', label: 'Checklist' },
  { value: 'Folder', label: 'Folder' },
  { value: 'Bookmark', label: 'Bookmark' },
  { value: 'Star', label: 'Star' },
  { value: 'Heart', label: 'Heart' },
  { value: 'Tag', label: 'Tag' },
  { value: 'Layers', label: 'Layers' },
];

export function ListFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  mode = 'create',
}: ListFormDialogProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    color: initialData?.color || '#6366f1',
    emoji: initialData?.emoji || '📋',
    icon: initialData?.icon || 'List',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
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
      console.error('Error saving list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleEmojiChange = (emoji: string) => {
    setFormData(prev => ({ ...prev, emoji }));
  };

  const handleIconChange = (icon: string) => {
    setFormData(prev => ({ ...prev, icon }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New List' : 'Edit List'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter list name"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Emoji */}
          <div>
            <Label>Emoji</Label>
            <div className="flex items-center space-x-2">
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiChange(emoji)}
                    className={`text-xl transition-transform hover:scale-110 ${
                      formData.emoji === emoji ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <span className="text-2xl ml-2">{formData.emoji}</span>
            </div>
          </div>

          {/* Color */}
          <div>
            <Label>Color</Label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-12 h-10 p-1 border border-input rounded cursor-pointer"
              />
              <Input
                value={formData.color}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-24"
              />
            </div>
          </div>

          {/* Icon */}
          <div>
            <Label>Icon</Label>
            <Select
              value={formData.icon}
              onValueChange={handleIconChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICONS.map((icon) => (
                  <SelectItem key={icon.value} value={icon.value}>
                    {icon.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[80px]"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}