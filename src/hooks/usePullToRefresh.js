import { useEffect, useRef, useState } from "react";

export function usePullToRefresh(onRefresh, containerRef) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const threshold = 70;

  useEffect(() => {
    const el = containerRef?.current || document.documentElement;

    const onTouchStart = (e) => {
      const scrollTop = containerRef?.current?.scrollTop ?? window.scrollY;
      if (scrollTop === 0) startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = async (e) => {
      if (startY.current === null) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      startY.current = null;
      if (dy > threshold && !refreshing) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, refreshing]);

  return refreshing;
}