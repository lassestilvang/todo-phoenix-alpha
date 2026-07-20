import { writeFile, mkdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure upload settings
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
  '.pdf', // Documents
  '.txt', '.md', '.csv', // Text files
  '.zip', '.rar', // Archives
  '.doc', '.docx', '.xls', '.xlsx', // Office files
];

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await stat(UPLOAD_DIR);
  } catch {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Validate file extension
 */
function isValidExtension(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Save uploaded file and return file info
 */
export async function saveUploadedFile(
  file: File,
  taskId: number
): Promise<{
  id: number;
  filename: string;
  fileType: string;
  fileData: string;
  url: string;
}> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
  }

  // Validate file extension
  if (!isValidExtension(file.name)) {
    throw new Error('File type not allowed');
  }

  // Ensure upload directory exists
  await ensureUploadDir();

  // Generate unique filename
  const fileExt = extname(file.name);
  const uniqueFilename = `${uuidv4()}${fileExt}`;
  const filePath = join(UPLOAD_DIR, uniqueFilename);

  // Convert File to Buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Write file to disk
  await writeFile(filePath, buffer);

  // Get file type (MIME type)
  const fileType = file.type || 'application/octet-stream';

  // For text files, we can store the content directly
  // For binary files, we might store a reference or base64
  let fileData: string;
  if (fileType.startsWith('text/') || fileType === 'application/json') {
    // Store text content directly
    fileData = buffer.toString('utf-8');
  } else {
    // For binary files, we could store as base64 or just store reference
    // For simplicity in this implementation, we'll store as base64
    // Note: For production, consider storing only references and serving files directly
    fileData = buffer.toString('base64');
  }

  // Create database record
  // Note: This assumes you'll call attachmentOperations.create separately
  // This function just prepares the data

  return {
    id: 0, // Will be set by database
    filename: uniqueFilename,
    fileType,
    fileData,
    url: `/uploads/${uniqueFilename}`,
  };
}

/**
 * Get file URL for serving
 */
export function getFileUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/**
 * Delete file from storage
 */
export async function deleteFile(filename: string): Promise<void> {
  const filePath = join(UPLOAD_DIR, filename);
  try {
    await writeFile(filePath, ''); // Clear file
    // In production, you might want to actually delete the file
    // await unlink(filePath);
  } catch (error) {
    // File might not exist, which is okay
    console.warn(`Could not clear file ${filename}:`, error);
  }
}