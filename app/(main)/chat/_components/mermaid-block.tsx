"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import CopyButton from "./copy-button";

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 3;

// ponytail: capped at 50 entries, oldest evicted first; keyed by theme so
// light/dark re-renders stay correct without re-invoking mermaid.
const svgCache = new Map<string, string>();

function cachedSvg(theme: string, chart: string): string | null {
  return svgCache.get(`${theme}|${chart}`) ?? null;
}

function storeSvg(theme: string, chart: string, svg: string) {
  if (svgCache.size >= 50) {
    const oldest = svgCache.keys().next();
    if (!oldest.done) svgCache.delete(oldest.value);
  }
  svgCache.set(`${theme}|${chart}`, svg);
}

function ZoomControls({
  zoomIndex,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoomIndex: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const btn =
    "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={onZoomOut} disabled={zoomIndex === 0} aria-label="Zoom out" title="Zoom out" className={btn}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <button
        onClick={onReset}
        aria-label="Reset zoom"
        title="Reset zoom"
        className="min-w-12 rounded-lg px-1.5 py-1 text-center text-[11px] tabular-nums text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        {Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%
      </button>
      <button onClick={onZoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1} aria-label="Zoom in" title="Zoom in" className={btn}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

function MermaidBlock({ chart }: { chart: string }) {
  const baseId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "neutral";
  const [result, setResult] = useState<{ chart: string; svg: string } | null>(null);
  const [failedChart, setFailedChart] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [expanded, setExpanded] = useState(false);
  const seq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fullScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chart.trim().length === 0 || cachedSvg(theme, chart)) return;
    let cancelled = false;
    const renderId = `mmd-${baseId}-${seq.current++}`;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme });
        const { svg } = await mermaid.render(renderId, chart);
        storeSvg(theme, chart, svg);
        if (!cancelled) setResult({ chart, svg });
      } catch {
        if (!cancelled) setFailedChart(chart);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, baseId, theme]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const failed = failedChart === chart;
  const rendered = result && result.chart === chart ? result.svg : null;
  const svg = rendered ?? cachedSvg(theme, chart);

  useEffect(() => {
    for (const ref of [scrollRef, fullScrollRef]) {
      const el = ref.current;
      if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    }
  }, [zoomIndex, svg]);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const zoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0));
  const resetZoom = () => setZoomIndex(DEFAULT_ZOOM_INDEX);

  const expandBtn = (
    <button
      onClick={() => setExpanded(true)}
      aria-label="View fullscreen"
      title="View fullscreen"
      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
    </button>
  );

  if (failed) {
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-border bg-code">
        <div className="flex justify-end border-b border-border/60 px-2 py-1">
          <CopyButton text={chart} />
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-code-foreground">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  const zoomControls = (
    <ZoomControls
      zoomIndex={zoomIndex}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onReset={resetZoom}
    />
  );

  const diagram = svg ? (
    <div style={{ width: `${zoom * 100}%` }} className="m-auto shrink-0">
      <div
        className="mermaid-svg flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  ) : (
    <p className="text-[12px] text-muted-foreground">Rendering diagram…</p>
  );

  return (
    <>
      <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            mermaid
          </span>
          <div className="flex items-center gap-0.5">
            {expandBtn}
            <CopyButton text={chart} />
          </div>
        </div>
        <div ref={scrollRef} className="flex max-h-[80vh] overflow-auto p-4">{diagram}</div>
        <div className="flex items-center justify-start border-t border-border/60 px-3 py-1">
          {zoomControls}
        </div>
      </div>

      {expanded && svg && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Diagram fullscreen view"
        >
          <button
            onClick={() => setExpanded(false)}
            aria-label="Close fullscreen view"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div
            className="mx-auto flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                mermaid
              </span>
              <div className="flex items-center gap-0.5">
                <CopyButton text={chart} />
              </div>
            </div>
            <div ref={fullScrollRef} className="flex overflow-auto p-6">{diagram}</div>
            <div className="flex items-center justify-start border-t border-border/60 px-3 py-1">
              {zoomControls}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(MermaidBlock);
