import db from './schema';
import { Attachment } from '../types';
import { createBackup } from './tasks';

export interface AttachmentAnalysis {
  filename: string;
  fileType: string;
  fileSize: number;
  hasTextContent: boolean;
  suggestedTags: string[];
  wordCount?: number;
  detectedLanguage?: string;
}

export interface AttachmentPreview {
  id: number;
  thumbnailPath: string;
  previewImage: string; // Base64-encoded thumbnail
  fileType: string;
  fileSize: number;
}

export const attachmentOperations = {
  getAll: (taskId: number): Attachment[] => {
    return db.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as Attachment[];
  },

  getById: (id: number): Attachment | undefined => {
    return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined;
  },

  create: (taskId: number, filename: string, file_type: string, file_data: string): Attachment => {
    const result = db.prepare(`
      INSERT INTO attachments (task_id, filename, file_type, file_data)
      VALUES (?, ?, ?, ?)
    `).run(taskId, filename, file_type, file_data);

    return attachmentOperations.getById(result.lastInsertRowid as number)!;
  },

  delete: (id: number): void => {
    db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  },

  deleteAllForTask: (taskId: number): void => {
    db.prepare('DELETE FROM attachments WHERE task_id = ?').run(taskId);
  },

  // Analyze attachment content (OCR, tag detection, etc.)
  analyzeAttachment: async (fileData: string, fileType: string): Promise<AttachmentAnalysis> => {
    // Determine file size from base64 data
    const fileSize = Math.ceil((fileData.length * 3) / 4); // Approximate base64 decode size

    let hasTextContent = false;
    let suggestedTags: string[] = [];
    let detectedLanguage: string | undefined;

    // Common text-based file types
    const textTypes = [
      'text/',
      'application/json',
      'application/csv',
      'application/xml',
      'application/rtf'
    ];

    // Image types that might have OCR'd text
    const imageTypes = [
      'image/',
      'application/pdf'
    ];

    const lowerFileType = file_type.toLowerCase();

    // Check if it's a text-based file
    if (textTypes.some(type => lowerFileType.startsWith(type))) {
      hasTextContent = true;
      // Try to detect common tags from filename conventions
      const filenameTags = fileData.match(/#(\w+)/g) || [];
      suggestedTags = filenameTags.map(tag => tag.replace('#', '')).filter(tag => tag.length > 2);
    }

    // Check if it's an image that could have text content
    if (imageTypes.some(type => lowerFileType.startsWith(type))) {
      // For image files, we would integrate with an OCR service
      // For now, mark as potentially having text
      hasTextContent = true;
      suggestedTags.push('image', 'photo');
    }

    // Check PDF for text content
    if (lowerFileType === 'application/pdf') {
      hasTextContent = true;
      suggestedTags.push('document', 'pdf');
    }

    // Default tags if none detected
    if (suggestedTags.length === 0) {
      suggestedTags = ['file', lowerFileType.split('/')[0] || 'unknown'];
    }

    return {
      filename: '',
      fileType,
      fileSize,
      hasTextContent,
      suggestedTags
    };
  },

  // Generate a preview/thumbnail for an attachment
  generatePreview: async (fileData: string, fileType: string): Promise<AttachmentPreview> => {
    const fileSize = Math.ceil((fileData.length * 3) / 4);
    let thumbnailPath = '';
    let previewImage = '';

    const lowerFileType = file_type.toLowerCase();

    // Generate thumbnail for images
    if (lowerFileType.startsWith('image/')) {
      // In a real implementation, we would use a library like sharp to create a thumbnail
      // For now, create a placeholder base64 image
      previewImage = `data:${file_type};base64,${fileData}`;
      thumbnailPath = `/thumbnails/${Date.now()}-thumb.${fileType.split('/')[1] || 'png'}`;
    }
    // Generate preview for PDFs
    else if (lowerFileType === 'application/pdf') {
      previewImage = `data:${file_type};base64,${fileData}`;
      thumbnailPath = '/thumbnails/pdf-thumb.png';
    }
    // Generate preview for documents
    else if (
      lowerFileType === 'application/msword' ||
      lowerFileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerFileType === 'application/vnd.ms-excel' ||
      lowerFileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      lowerFileType === 'application/vnd.oasis.opendocument.text' ||
      lowerFileType === 'application/vnd.oasis.opendocument.spreadsheet'
    ) {
      previewImage = `data:${file_type};base64,${fileData}`;
      thumbnailPath = '/thumbnails/doc-thumb.png';
    }
    // Generic file thumbnail
    else {
      previewImage = `data:${file_type};base64,${fileData}`;
      thumbnailPath = '/thumbnails/file-thumb.png';
    }

    return {
      id: 0, // Will be set by caller
      thumbnailPath,
      previewImage,
      fileType,
      fileSize
    };
  },

  // Get suggested tags for an attachment based on its content
  getSuggestedTags: (analysis: AttachmentAnalysis): string[] => {
    // Start with detected tags
    const tags = [...analysis.suggestedTags];

    // Add common tags based on file type
    const typeLower = analysis.fileType.toLowerCase();
    if (typeLower.includes('image') || typeLower.includes('photo')) {
      tags.push('photo', 'picture');
    }
    if (typeLower.includes('pdf') || typeLower.includes('document')) {
      tags.push('document', 'report');
    }
    if (typeLower.includes('spreadsheet') || typeLower.includes('excel')) {
      tags.push('spreadsheet', 'data');
    }
    if (typeLower.includes('presentation') || typeLower.includes('powerpoint')) {
      tags.push('presentation', 'slides');
    }

    // Remove duplicates
    return [...new Set(tags)];
  }
};
