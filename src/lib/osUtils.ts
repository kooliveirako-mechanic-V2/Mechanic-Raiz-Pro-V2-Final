/**
 * Utility functions for OS (Ordem de Serviço) management
 */

/**
 * Calculate elapsed time since OS creation, returning a human-readable string
 */
export function getElapsedTime(createdAt: string): { text: string; hours: number; isStale: boolean } {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  const isStale = diffHours >= 48; // OS parada há mais de 48h

  if (diffDays > 0) {
    return { text: `${diffDays}d`, hours: diffHours, isStale };
  }
  if (diffHours > 0) {
    return { text: `${diffHours}h`, hours: diffHours, isStale };
  }
  const diffMin = Math.floor(diffMs / (1000 * 60));
  return { text: `${Math.max(1, diffMin)}min`, hours: 0, isStale: false };
}

/**
 * Calculate elapsed time since last update
 */
export function getTimeSinceUpdate(updatedAt: string): { hours: number; isStale: boolean } {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  return { hours: diffHours, isStale: diffHours >= 24 };
}
