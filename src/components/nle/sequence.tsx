"use client";

import { TrackItem } from "@/components/nle/utils/markdown-parser";
import { msToPercentage } from "@/lib/time-utils";
import { useMemo, memo } from "react";
import "@/styles/nle.css";

// Track configuration: h1=0, h2=1, h3=2, media=3, p=4, ul=5
const TRACK_CONFIG = [
  { label: "<h1>", name: "Header 1", type: "h1" as const },
  { label: "<h2>", name: "Header 2", type: "h2" as const },
  { label: "<h3>", name: "Header 3", type: "h3" as const },
  { label: "media", name: "Media", type: "media" as const },
  { label: "<p>", name: "Paragraph", type: "p" as const },
  { label: "<ul>", name: "List", type: "ul" as const },
];

interface ClipRendererProps {
  item: TrackItem;
  totalDurationMs: number;
  timelineWidth: number;
}

// Memoize ClipRenderer to prevent unnecessary re-renders
const ClipRenderer = memo(({ item, totalDurationMs, timelineWidth }: ClipRendererProps) => {
  // Convert milliseconds to percentage, then to pixels
  const startPercentage = msToPercentage(item.start, totalDurationMs);
  const endPercentage = msToPercentage(item.end, totalDurationMs);
  const left = startPercentage * timelineWidth;
  const width = (endPercentage - startPercentage) * timelineWidth;

  // Professional NLE-style appearance
  // Light mode: Saturated gradients, distinct borders, slight transparency
  // Dark mode: Deep semi-transparent colors with distinct borders
  const getClipColor = () => {
    switch (item.type) {
      case "h1":
        return "bg-gradient-to-b from-blue-200/90 to-blue-300/90 border-blue-400/80 text-blue-900 dark:from-blue-600/40 dark:to-blue-600/20 dark:border-blue-400/60 dark:text-blue-50";
      case "h2":
        return "bg-gradient-to-b from-teal-200/90 to-teal-300/90 border-teal-400/80 text-teal-900 dark:from-teal-600/40 dark:to-teal-600/20 dark:border-teal-400/60 dark:text-teal-50";
      case "h3":
        return "bg-gradient-to-b from-violet-200/90 to-violet-300/90 border-violet-400/80 text-violet-900 dark:from-violet-600/40 dark:to-violet-600/20 dark:border-violet-400/60 dark:text-violet-50";
      case "img":
        return "bg-gradient-to-b from-rose-200/90 to-rose-300/90 border-rose-400/80 text-rose-900 dark:from-rose-600/40 dark:to-rose-600/20 dark:border-rose-400/60 dark:text-rose-50";
      case "p":
        return "bg-gradient-to-b from-slate-200/90 to-slate-300/90 border-slate-400/80 text-slate-900 dark:from-slate-600/40 dark:to-slate-600/20 dark:border-slate-400/60 dark:text-slate-200";
      case "embed":
        return "bg-gradient-to-b from-red-200/90 to-red-300/90 border-red-400/80 text-red-900 dark:from-red-600/40 dark:to-red-600/20 dark:border-red-400/60 dark:text-red-50";
      case "ul":
        return "bg-gradient-to-b from-amber-200/90 to-amber-300/90 border-amber-400/80 text-amber-900 dark:from-amber-600/40 dark:to-amber-600/20 dark:border-amber-400/60 dark:text-amber-50";
      case "widget":
        return "bg-gradient-to-b from-emerald-200/90 to-emerald-300/90 border-emerald-400/80 text-emerald-900 dark:from-emerald-600/40 dark:to-emerald-600/20 dark:border-emerald-400/60 dark:text-emerald-50";
      default:
        return "bg-gradient-to-b from-gray-200/90 to-gray-300/90 border-gray-400/80 text-gray-900 dark:from-gray-600/40 dark:to-gray-600/20 dark:border-gray-400/60 dark:text-gray-50";
    }
  };

  return (
    <div
      style={{
        left: `${left}px`,
        width: `${Math.max(20, width - 1)}px`, // Reduced gap between clips
        minWidth: "20px",
      }}
      className={`clip border ${getClipColor()} rounded-md px-2 py-0.5 text-xs font-medium overflow-hidden shadow hover:brightness-95 dark:hover:brightness-110 transition-all cursor-pointer flex items-center select-none`}
      title={`${item.name} (${item.start}ms - ${item.end}ms)`}
    >
      <div className="truncate drop-shadow-sm">{item.name}</div>
    </div>
  );
});

ClipRenderer.displayName = "ClipRenderer";

interface SequenceProps {
  clips: TrackItem[];
  totalDurationMs: number;
  zoomLevel: number;
}

// Memoize entire Sequence component
export const Sequence = memo(({ clips, totalDurationMs, zoomLevel }: SequenceProps) => {
  // Calculate timeline width:
  // 1. Base width fits all content with 10% padding on the right (50px per second * 1.1)
  // 2. This becomes the "natural fit" baseline, which is 100% zoom (zoomLevel = 1)
  // 3. Zooming in/out scales relative to this baseline
  const minTimelineWidth = useMemo(() => {
    // Calculate base width that fits all content with 10% right padding
    // This padded width is what we consider "100%" zoom
    const baseWidth = Math.max(2000, (totalDurationMs / 1000) * 50 * 1.1);
    return baseWidth * zoomLevel;
  }, [totalDurationMs, zoomLevel]);

  // Group clips by track - memoized to prevent recalculation
  const clipsByTrack = useMemo(() => {
    const grouped: Record<number, TrackItem[]> = {};
    for (const clip of clips) {
      if (!grouped[clip.track]) {
        grouped[clip.track] = [];
      }
      grouped[clip.track].push(clip);
    }
    return grouped;
  }, [clips]);

  return (
    <div className="timeline-tracks-area">
      {TRACK_CONFIG.map((config, trackIndex) => {
        const trackClips = clipsByTrack[trackIndex] || [];
        return (
          <div
            key={`content-${trackIndex}`}
            className="track-content"
            style={{ minWidth: `${minTimelineWidth}px` }}
          >
            {trackClips.map((clip) => (
              <ClipRenderer
                key={clip.id}
                item={clip}
                totalDurationMs={totalDurationMs}
                timelineWidth={minTimelineWidth}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});

Sequence.displayName = "Sequence";