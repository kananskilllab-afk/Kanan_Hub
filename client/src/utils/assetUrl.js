const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Uploaded files (e.g. avatarUrl) are stored as server-relative paths like '/uploads/avatars/x.jpg' —
// this resolves them against the API's origin rather than the Vite dev server's.
export function assetUrl(relativePath) {
  return relativePath ? `${ORIGIN}${relativePath}` : null;
}
