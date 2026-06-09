import { useRef, useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface PullToRefreshOptions {
  threshold?: number;
  onRefresh?: () => Promise<void>;
}

export function usePullToRefresh({ threshold = 80, onRefresh }: PullToRefreshOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0); // mirror of pullDistance for event handlers
  const isRefreshingRef = useRef(false);
  const queryClient = useQueryClient();

  // Keep refs in sync
  isRefreshingRef.current = isRefreshing;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (navigator.vibrate) navigator.vibrate(15);

    if (onRefresh) {
      await onRefresh();
    } else {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }

    await new Promise((r) => setTimeout(r, 600));
    setIsRefreshing(false);
    setPullDistance(0);
    pullDistanceRef.current = 0;
  }, [onRefresh, queryClient]);

  // Stable ref for handleRefresh
  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getScrollTop = () => {
      if (el.scrollTop > 0) return el.scrollTop;
      let parent = el.parentElement;
      while (parent) {
        if (parent.scrollTop > 0) return parent.scrollTop;
        parent = parent.parentElement;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || isRefreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && getScrollTop() <= 0) {
        e.preventDefault();
        const dist = Math.min(dy * 0.5, threshold * 1.5);
        pullDistanceRef.current = dist;
        setPullDistance(dist);
      } else if (dy < 0) {
        pulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistanceRef.current >= threshold && !isRefreshingRef.current) {
        handleRefreshRef.current();
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
    // Stable deps only — no pullDistance!
  }, [threshold]);

  return { containerRef, isRefreshing, pullDistance, isPulling: pullDistance > 0 };
}
