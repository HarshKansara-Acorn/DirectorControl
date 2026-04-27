/**
 * File upload helper — validates and processes base64 file uploads.
 * Consistent with the existing photo upload pattern in users route.
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB base64 string (~7.5MB raw)

const ALLOWED_TYPES = {
  // Documents
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'text/plain': 'txt',
  // Images
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Validate a base64 file upload.
 * @param {string} fileData - Base64 data URL (e.g. "data:application/pdf;base64,...")
 * @returns {{ valid: boolean, error?: string, mimeType?: string, ext?: string, sizeBytes?: number }}
 */
const validateFile = (fileData) => {
  if (!fileData || typeof fileData !== 'string') {
    return { valid: false, error: 'No file provided' };
  }

  // Must be a data URL
  const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { valid: false, error: 'Invalid file format. Must be a base64 data URL.' };
  }

  const [, mimeType, base64Content] = match;

  // Check allowed type
  if (!ALLOWED_TYPES[mimeType]) {
    return {
      valid: false,
      error: `File type not allowed. Supported: PDF, Word, Excel, PowerPoint, images (JPEG, PNG, GIF, WebP).`,
    };
  }

  // Check size
  if (fileData.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.floor(MAX_FILE_SIZE / (1024 * 1024))}MB.`,
    };
  }

  // Estimate raw file size (base64 is ~1.37x larger than raw)
  const sizeBytes = Math.floor((base64Content.length * 3) / 4);

  return {
    valid: true,
    mimeType,
    ext: ALLOWED_TYPES[mimeType],
    sizeBytes,
  };
};

/**
 * Format file size for display.
 * @param {number} bytes
 * @returns {string} e.g. "2.4 MB"
 */
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

module.exports = { validateFile, formatFileSize, MAX_FILE_SIZE };
