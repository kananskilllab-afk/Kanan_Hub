const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Newer avatars are stored as data: URIs (usable as-is); older ones may still be server-relative
// paths like '/uploads/avatars/x.jpg', which need resolving against the API's origin.
export function assetUrl(relativePath) {
  if (!relativePath) return null;
  if (/^(data|https?):/.test(relativePath)) return relativePath;
  return `${ORIGIN}${relativePath}`;
}
