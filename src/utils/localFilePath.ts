/**
 * Normalizes a local filesystem path from the DB for react-native-fs.
 * Strips file://, trims, and URI-decodes when needed (some layers store %20 for spaces).
 */
export function normalizeLocalFilePath(stored: string | null | undefined): string {
  if (stored == null || stored === '') return '';
  let path = String(stored).trim();
  if (path.startsWith('file://')) {
    path = path.replace(/^file:\/\//, '');
  }
  if (path.includes('%')) {
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep path */
    }
  }
  return path;
}
