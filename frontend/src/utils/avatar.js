export function avatarUrl(seed) {
  if (!seed) return '';
  return `/api/avatars/${encodeURIComponent(seed)}`;
}
