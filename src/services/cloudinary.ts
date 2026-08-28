/**
 * src/services/cloudinary.ts
 *
 * Cloudinary upload engine — the APP-WIDE standard for ALL image/file uploads.
 *
 * ── Rule for the whole codebase ───────────────────────────────────────────────
 * Any form that uploads an image or file (student photos, org/club logos, event
 * cover images, certificate templates, liquidation receipts, document attachments,
 * etc.) MUST upload through this service. Firestore stores ONLY the returned
 * `secure_url` string — never the binary, never a blob: URL.
 *
 * ── Security ──────────────────────────────────────────────────────────────────
 * This is a browser (Vite/React) app, so everything here ships to the client.
 * We use an UNSIGNED upload preset — only the cloud name + preset name are needed,
 * both of which are safe to expose publicly.
 * NEVER put the Cloudinary API Secret (or API Key) in this file or anywhere in
 * client code. Signed uploads/deletes belong on a backend, which this app does
 * not have.
 */

import axios from 'axios';

// ─── Config (safe to expose — unsigned preset) ────────────────────────────────
export const CLOUDINARY_CLOUD_NAME = 'djwlkcgnx';
export const CLOUDINARY_UPLOAD_PRESET = 'sti_sync_uploads';

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// ─── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface CloudinaryUploadResult {
  /** Permanent HTTPS URL — this is what you store in Firestore. */
  secureUrl: string;
  /** Cloudinary public id — keep if you ever need server-side management later. */
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: string;
}

export interface UploadOptions {
  /**
   * Cloudinary folder to organise the asset, e.g. 'students/profile',
   * 'organizations/logos', 'events/covers'. Helps keep the media library tidy.
   */
  folder?: string;
  /** Override the accepted MIME types. Defaults to common image types. */
  acceptedTypes?: string[];
  /** Override the max file size in bytes. Defaults to 5 MB. */
  maxBytes?: number;
  /** Optional progress callback (0–100). */
  onProgress?: (percent: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable size, e.g. "5 MB". */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Validates a file against type/size rules.
 * @throws Error with a human-readable message if invalid.
 */
export function validateUploadFile(file: File, options: UploadOptions = {}): void {
  const accepted = options.acceptedTypes ?? DEFAULT_ACCEPTED;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (accepted.length > 0) {
    const fileType = file.type?.toLowerCase() || '';
    const fileName = file.name?.toLowerCase() || '';

    const matchesMime = accepted.some(t => t.toLowerCase() === fileType);
    const matchesExtension = accepted.some(t => {
      if (t.startsWith('.')) return fileName.endsWith(t.toLowerCase());
      if (t === 'application/pdf' && fileName.endsWith('.pdf')) return true;
      if ((t.includes('word') || t.includes('msword') || t.includes('officedocument.word')) && (fileName.endsWith('.doc') || fileName.endsWith('.docx'))) return true;
      if ((t.includes('excel') || t.includes('spreadsheet') || t.includes('officedocument.sheet')) && (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv'))) return true;
      if (t === 'image/*' && fileType.startsWith('image/')) return true;
      return false;
    });

    if (!matchesMime && !matchesExtension) {
      throw new Error(
        `Unsupported file type "${file.type || fileName.split('.').pop() || 'unknown'}". Allowed formats: PDF, Word DOC/DOCX, PNG, JPG.`
      );
    }
  }
  if (file.size > maxBytes) {
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max allowed size is ${formatBytes(maxBytes)}.`);
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Uploads a single file to Cloudinary using the unsigned preset.
 * Returns the secure URL + metadata. Store `secureUrl` in Firestore.
 *
 * @throws Error with a human-readable `.message` on validation or network failure.
 */
export async function uploadToCloudinary(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  validateUploadFile(file, options);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.folder) formData.append('folder', options.folder);

  try {
    const { data } = await axios.post(CLOUDINARY_UPLOAD_URL, formData, {
      onUploadProgress: (evt) => {
        if (options.onProgress && evt.total) {
          options.onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });

    return {
      secureUrl: data.secure_url,
      publicId: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      resourceType: data.resource_type,
    };
  } catch (err: unknown) {
    // Surface Cloudinary's error message when available.
    if (axios.isAxiosError(err)) {
      const apiMsg = (err.response?.data as { error?: { message?: string } })?.error?.message;
      throw new Error(apiMsg ?? 'Upload failed. Please check your connection and try again.');
    }
    throw new Error('Upload failed. Please try again.');
  }
}
