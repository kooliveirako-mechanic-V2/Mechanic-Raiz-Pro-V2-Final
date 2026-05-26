/**
 * Build version tracking for PWA cache validation.
 * The BUILD_TIMESTAMP is set at build time via Vite's define config.
 */

// Injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;
declare const __BUILD_ID__: string;

export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== "undefined" 
  ? __BUILD_TIMESTAMP__ 
  : new Date().toISOString();

export const BUILD_ID = typeof __BUILD_ID__ !== "undefined"
  ? __BUILD_ID__
  : "dev-" + Date.now().toString(36);

/**
 * Force-clear all caches, unregister service workers, and reload.
 */
export async function forceUpdateApp(): Promise<void> {
  try {
    // 1. Unregister all service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      console.log(`[ForceUpdate] Unregistered ${registrations.length} service workers`);
    }

    // 2. Clear all caches
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      console.log(`[ForceUpdate] Deleted ${keys.length} caches`);
    }

    // 3. Clear localStorage version markers
    try {
      localStorage.removeItem("mechanic_last_build");
    } catch {}

    // 4. Hard reload bypassing cache
    window.location.replace(window.location.href + (window.location.href.includes("?") ? "&" : "?") + "_v=" + Date.now());
  } catch (err) {
    console.error("[ForceUpdate] Error:", err);
    // Fallback: simple reload
    window.location.reload();
  }
}

/**
 * Check if a new version is available by comparing build timestamps.
 */
export function checkForUpdate(): { isStale: boolean; currentBuild: string; storedBuild: string | null } {
  const storedBuild = localStorage.getItem("mechanic_last_build");
  const isStale = storedBuild !== null && storedBuild !== BUILD_TIMESTAMP;
  
  // Always store current build
  try {
    localStorage.setItem("mechanic_last_build", BUILD_TIMESTAMP);
  } catch {}

  return { isStale, currentBuild: BUILD_TIMESTAMP, storedBuild };
}

/**
 * Get SW status for diagnostics
 */
export async function getServiceWorkerStatus(): Promise<{
  hasServiceWorker: boolean;
  registrations: number;
  cacheNames: string[];
}> {
  let registrations = 0;
  let cacheNames: string[] = [];

  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    registrations = regs.length;
  }

  if ("caches" in window) {
    cacheNames = await caches.keys();
  }

  return {
    hasServiceWorker: "serviceWorker" in navigator,
    registrations,
    cacheNames,
  };
}
