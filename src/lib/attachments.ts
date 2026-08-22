/**
 * Attachment Management Service
 * Handles file uploads, storage, versioning, and preview generation
 */
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { encryptionService } from '@/lib/security/encryption';

export type AttachmentType = 'image' | 'document' | 'spreadsheet' | 'presentation' | 'other';

export interface Attachment {
  id: string;
  taskId: string;
  filename: string;
  originalName: string;
  fileType: AttachmentType;
  fileSize: number;
  fileData: string; // Base64 encoded
  version: number;
  checksum: string;
  createdAt: string;
  createdBy: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface AttachmentUploadResult {
  attachment: Attachment;
  message: string;
}

export interface AttachmentState {
  attachments: Map<string, Map<string, Attachment>>; // taskId -> (attachmentId -> Attachment)
  uploadHistory: Array<{ id: string; taskId: string; status: 'success' | 'failed'; timestamp: number }>;

  // Methods
  uploadAttachment: (taskId: string, file: File) => Promise<AttachmentUploadResult>;
  getTaskAttachments: (taskId: string) => Attachment[];
  getAttachment: (attachmentId: string) => Attachment | null;
  createVersion: (attachmentId: string, newFile: File) => Promise<AttachmentUploadResult>;
  deleteAttachment: (attachmentId: string) => boolean;
  getThumbnail: (attachment: Attachment) => string | undefined;
  getFileIcon: (attachment: Attachment) => string;
}

/**
 * Determine file type from filename (standalone helper function)
 */
export function determineFileType(filename: string): AttachmentType {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return 'image';
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
      return 'document';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'spreadsheet';
    case 'ppt':
    case 'pptx':
      return 'presentation';
    default:
      return 'other';
  }
}

export const useAttachments = create<AttachmentState>((set, get) => ({
  attachments: new Map(),
  uploadHistory: [],

  // Upload a new attachment
  uploadAttachment: async (taskId: string, file: File): Promise<AttachmentUploadResult> => {
    const reader = new FileReader();
    const checksum = uuidv4(); // In production, use actual checksum
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const attachment: Attachment = {
      id: uuidv4(),
      taskId,
      filename: file.name,
      originalName: file.name,
      fileType: determineFileType(file.name),
      fileSize: file.size,
      fileData: fileData || '',
      version: 1,
      checksum,
      createdAt: new Date().toISOString(),
      createdBy: 'user', // In production, get from auth
    };

    // Store attachment
    const currentAttachments = get().attachments.get(taskId) || new Map();
    currentAttachments.set(attachment.id, attachment);
    set(state => ({
      attachments: new Map(state.attachments).set(taskId, currentAttachments),
    }));

    // Record upload history
    get().uploadHistory.push({
      id: uuidv4(),
      taskId,
      status: 'success',
      timestamp: Date.now(),
    });

    return {
      attachment,
      message: `Successfully uploaded ${file.name}`,
    };
  },

  // Determine file type from filename
  determineFileType: (filename: string): AttachmentType => {
    return determineFileType(filename);
  },

  // Get attachments for a task
  getTaskAttachments: (taskId: string): Attachment[] => {
    return Array.from(get().attachments.get(taskId)?.values() ?? []);
  },

  // Get attachment by ID
  getAttachment: (attachmentId: string): Attachment | null => {
    for (const [, attachments] of get().attachments) {
      if (attachments.has(attachmentId)) {
        return attachments.get(attachmentId)!;
      }
    }
    return null;
  },

  // Create a new version of an attachment
  createVersion: async (attachmentId: string, newFile: File): Promise<AttachmentUploadResult> => {
    const existing = get().getAttachment(attachmentId);
    if (!existing) {
      throw new Error('Attachment not found');
    }

    // Increment version
    const newVersion = existing.version + 1;

    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(newFile);
    });

    const newAttachment: Attachment = {
      ...existing,
      filename: newFile.name,
      originalName: newFile.name,
      fileSize: newFile.size,
      version: newVersion,
      fileData: fileData || existing.fileData,
      checksum: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    // Replace with new version
    const currentAttachments = get().attachments.get(existing.taskId)!;
    currentAttachments.set(attachmentId, newAttachment);
    set(state => {
      const newMap = new Map(state.attachments);
      newMap.set(existing.taskId, currentAttachments);
      return { attachments: newMap };
    });

    return {
      attachment: newAttachment,
      message: `Created version ${newVersion} of ${existing.filename}`,
    };
  },

  // Delete an attachment
  deleteAttachment: (attachmentId: string): boolean => {
    const existing = get().getAttachment(attachmentId);
    if (!existing) return false;

    const currentAttachments = get().attachments.get(existing.taskId)!;
    currentAttachments.delete(attachmentId);
    set(state => {
      const newMap = new Map(state.attachments);
      newMap.set(existing.taskId, currentAttachments);
      return { attachments: newMap };
    });

    return true;
  },

  // Get thumbnail for display
  getThumbnail: (attachment: Attachment): string | undefined => {
    if (attachment.thumbnail) return attachment.thumbnail;

    // Generate basic thumbnail based on file type
    const typeMap: Record<AttachmentType, string> = {
      image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzMiIHJ4PSIzNSIgc3R5bG09ImZpbGw6I2ltcG9ydC1zeXMuY3N2IiB2aWV3Qm94PSItMyAzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2UtdGV4dC1hbmNob3I9Im1pZGRsZSIgc3Ryb2xsNjAtt2ZXJzaW9uP/SmQlhXaV7iIiI8L3N2Zz4=',
      document: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzMiIHJ4PSIzNSIgc3R5bG09ImZpbGw6I2ltcG9ydC1zeXMuY3N2IiB2aWV3Qm94PSItMyAzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2UtdGV4dC1hbmNob3I9Im1pZGRsZSIgc3Ryb2xsNjAtt2ZXJzaW9uP/SmQlhXaV7iIiI8L3N2Zz4=',
      spreadsheet: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzMiIHJ4PSIzNSIgc3R5bG09ImZpbGw6I2ltcG9ydC1zeXMuY3N2IiB2aWV3Qm94PSItMyAzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2UtdGV4dC1hbmNob3I9Im1pZGRsZSIgc3Ryb2xsNjAtt2ZXJzaW9uP/SmQlhXaV7iIiI8L3N2Zz4=',
      presentation: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzMiIHJ4PSIzNSIgc3R5bG09ImZpbGw6I2ltcG9ydC1zeXMuY3N2IiB2aWV3Qm94PSItMyAzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2UtdGV4dC1hbmNob3I9Im1pZGRsZSIgc3Ryb2xsNjAtt2ZXJzaW9uP/SmQlhXaV7iIiI8L3N2Zz4=',
      other: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzMiIHJ4PSIzNSIgc3R5bG09ImZpbGw6I2ltcG9ydC1zeXMuY3N2IiB2aWV3Qm94PSItMyAzIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2UtdGV4dC1hbmNob3I9Im1pZGRsZSIgc3Ryb2xsNjAtt2ZXJzaW9uP/SmQlhXaV7iIiI8L3N2Zz4=',
    };

    return typeMap[attachment.fileType] || typeMap.other;
  },

  // Get file icon based on type
  getFileIcon: (attachment: Attachment): string => {
    const iconMap: Record<AttachmentType, string> = {
      image: '🖼️',
      document: '📄',
      spreadsheet: '📊',
      presentation: '📊',
      other: '📎',
    };
    return iconMap[attachment.fileType] || iconMap.other;
  },
}));