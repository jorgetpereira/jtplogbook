import { useState, useRef, useLayoutEffect, createContext, useContext } from "react";

/**
 * Context: increment this value to force all ChartWrappers to re-measure.
 * Used by Reports.jsx when switching tabs, so charts in the newly-visible
 * tab measure their container width and render immediately.
 */
export const ChartMeasureContext = createContext(0);

/**
 * Wrapper fiável para gráficos recharts.
 * Mede a largura real do contentor usando múltiplas estratégias
 * (getBoundingClientRect, clientWidth, offsetWidth) e vários
 * fallbacks temporais (rAF + 4 timeouts) para garantir que o
 * gráfico sempre renderiza, mesmo após refresh ou mudança de separador.
 *
 * O `measureKey` (via context) força re-medição quando o separador muda.
 */
export default function ChartWrapper({ height = 260, children }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const measureKey = useContext(ChartMeasureContext);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || el.clientWidth || el.offsetWidth || 0;
      if (w > 0) setWidth(prev => (prev !== w ? w : prev));
    };

    // Mede imediatamente (antes do paint)
    measure();

    // Fallbacks: rAF + múltiplos timeouts para captar diferentes cenários
    const raf = requestAnimationFrame(measure);
    const timeouts = [30, 100, 300, 800].map(ms => setTimeout(measure, ms));

    // ResizeObserver para mudanças subsequentes
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
    };
  }, [height, measureKey]);

  return (
    <div ref={containerRef} style={{ width: "100%", height }} className="relative">
      {width > 0 ? children(width, height) : <div style={{ height }} />}
    </div>
  );
}