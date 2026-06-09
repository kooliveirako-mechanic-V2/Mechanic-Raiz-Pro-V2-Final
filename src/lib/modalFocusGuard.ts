let listenersBound = false;
let lastExplicitCloseIntentAt = 0;

/**
 * Grace period after tab regains visibility.
 * Absorbs Radix's spurious onOpenChange(false) without blocking real user actions.
 */
const GRACE_AFTER_RETURN_MS = 1200;
const EXPLICIT_CLOSE_INTENT_MS = 1500;

/**
 * Grace period after document regains focus (covers the gap between
 * window focus and visibilitychange which can be significant on mobile).
 */
const GRACE_AFTER_FOCUS_MS = 1500;

/** Timestamp when the tab last returned from being hidden */
let lastReturnedAt = 0;

/** Timestamp when the document last regained focus */
let lastFocusAt = 0;

function bindFocusGuardListeners() {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        lastReturnedAt = Date.now();
      }
    },
    true,
  );

  // Track window focus regain — fires BEFORE visibilitychange on some
  // browsers and catches the gap where Radix fires onFocusOutside.
  window.addEventListener(
    "focus",
    () => {
      lastFocusAt = Date.now();
    },
    true,
  );
}

function hasRecentExplicitCloseIntent() {
  return Date.now() - lastExplicitCloseIntentAt < EXPLICIT_CLOSE_INTENT_MS;
}

export function markExplicitCloseIntent() {
  lastExplicitCloseIntentAt = Date.now();
}

/**
 * Returns true when a close event should be IGNORED because it was caused
 * by a transient focus loss (tab switch, app switch, etc.) rather than
 * a deliberate user action.
 */
export function shouldIgnoreTransientClose() {
  if (typeof document === "undefined") return false;

  bindFocusGuardListeners();

  // User explicitly clicked close / pressed ESC — always honour
  if (hasRecentExplicitCloseIntent()) {
    return false;
  }

  // Tab is currently hidden — block close
  if (document.visibilityState === "hidden") {
    return true;
  }

  // KEY FIX: Document lost focus (user switched to another tab/app/window).
  // Radix fires onFocusOutside BEFORE visibilitychange, so
  // visibilityState is still "visible" at that point.
  // document.hasFocus() returns false immediately when the window
  // loses focus — this catches the gap.
  if (!document.hasFocus()) {
    return true;
  }

  // Tab just returned from hidden — block spurious close events during grace period
  if (Date.now() - lastReturnedAt < GRACE_AFTER_RETURN_MS) {
    return true;
  }

  // Document just regained focus — block spurious events during grace
  if (Date.now() - lastFocusAt < GRACE_AFTER_FOCUS_MS) {
    return true;
  }

  return false;
}
