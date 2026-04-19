/**
 * Supabase Storage helpers for cross-device book file sync.
 *
 * Storage path convention: books/{userId}/{bookId}.{fileType}
 * Bucket name: "books"  (private, must be created in the Supabase dashboard)
 */
import RNFS from 'react-native-fs';
import {supabase} from './supabase';

const BUCKET = 'books';

function storagePath(userId: string, bookId: string, fileType: string): string {
  return `${userId}/${bookId}.${fileType}`;
}

/**
 * Upload a local book file to Supabase Storage.
 * Reads the file as base64 via RNFS, decodes to a Uint8Array, then uploads
 * via the Supabase JS client — the standard recommended approach for React Native.
 */
export async function uploadBookToStorage(
  localPath: string,
  userId: string,
  bookId: string,
  fileType: 'epub' | 'pdf',
): Promise<void> {
  const path = storagePath(userId, bookId, fileType);
  const contentType =
    fileType === 'epub' ? 'application/epub+zip' : 'application/pdf';

  // Read as base64 then decode to binary — works on all RN/Hermes versions
  const base64 = await RNFS.readFile(localPath, 'base64');
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const {error} = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {contentType, upsert: true});

  if (error) {
    throw new Error(`Cloud upload failed: ${error.message}`);
  }
}

/**
 * Download a book file from Supabase Storage to a local path.
 * @param onProgress Optional callback with 0–100 percentage.
 */
export async function downloadBookFromStorage(
  userId: string,
  bookId: string,
  fileType: 'epub' | 'pdf',
  destPath: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const path = storagePath(userId, bookId, fileType);

  const {data, error} = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message?.includes('Object not found')
        ? 'This book has not been synced to the cloud yet. Open it on the device you used to import it first.'
        : `Could not get download URL: ${error?.message ?? 'unknown error'}`,
    );
  }

  // Ensure destination directory exists
  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  await RNFS.mkdir(dir).catch(() => {});

  const {promise} = RNFS.downloadFile({
    fromUrl: data.signedUrl,
    toFile: destPath,
    progressDivider: 5,
    progress: res => {
      if (onProgress && res.contentLength > 0) {
        onProgress(Math.round((res.bytesWritten / res.contentLength) * 100));
      }
    },
  });

  const result = await promise;
  if (result.statusCode !== 200) {
    await RNFS.unlink(destPath).catch(() => {});
    throw new Error(`Download failed (HTTP ${result.statusCode})`);
  }
}

/**
 * Destination path for a downloaded book on this device.
 * Always uses the bookId so it's deterministic and collision-free.
 */
export function localBookPath(bookId: string, fileType: 'epub' | 'pdf'): string {
  return `${RNFS.DocumentDirectoryPath}/books/${bookId}.${fileType}`;
}
