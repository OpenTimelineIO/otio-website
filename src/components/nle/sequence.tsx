"use client";

import { TrackItem } from "@/components/nle/utils/markdown-parser";
import { msToPercentage } from "@/lib/time-utils";
import { useMemo, memo } from "react";
import { Heading1, Heading2, Heading3, Image, AlignLeft, List, Video } from "lucide-react";
import "@/styles/nle.css";

// Track configuration: h1=0, h2=1, h3=2, img=3, p=4, embed=5, ul=6
const TRACK_CONFIG = [
  { label: "<h1>", name: "Header 1", type: "h1" as const },
  { label: "<h2>", name: "Header 2", type: "h2" as const },
  { label: "<h3>", name: "Header 3", type: "h3" as const },
  { label: "<img>", name: "Image", type: "img" as const },
  { label: "<p>", name: "Paragraph", type: "p" as const },
  { label: "<ul>", name: "List", type: "ul" as const },
  { label: "<embed>", name: "Embed", type: "embed" as const },
];

const CLIP_ICONS: Record<string, React.ElementType> = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  img: Image,
  p: AlignLeft,
  ul: List,
  embed: Video,
};

const ClipIcon = memo(({ type }: { type: string }) => {
  const Icon = CLIP_ICONS[type];
  if (!Icon) return null;
  return <Icon size={11} strokeWidth={2} className="shrink-0 mr-1 opacity-60" />;
});
ClipIcon.displayName = "ClipIcon";

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
        return "bg-gradient-to-b from-blue-200 to-blue-300/80 border-blue-300/60 border-l-blue-500 text-blue-900 dark:from-blue-500/30 dark:to-blue-700/18 dark:border-blue-500/25 dark:border-l-blue-400 dark:text-blue-100";
      case "h2":
        return "bg-gradient-to-b from-teal-200 to-teal-300/80 border-teal-300/60 border-l-teal-500 text-teal-900 dark:from-teal-500/30 dark:to-teal-700/18 dark:border-teal-500/25 dark:border-l-teal-400 dark:text-teal-100";
      case "h3":
        return "bg-gradient-to-b from-violet-200 to-violet-300/80 border-violet-300/60 border-l-violet-500 text-violet-900 dark:from-violet-500/30 dark:to-violet-700/18 dark:border-violet-500/25 dark:border-l-violet-400 dark:text-violet-100";
      case "img":
        return "bg-gradient-to-b from-rose-200 to-rose-300/80 border-rose-300/60 border-l-rose-500 text-rose-900 dark:from-rose-500/30 dark:to-rose-700/18 dark:border-rose-500/25 dark:border-l-rose-400 dark:text-rose-100";
      case "p":
        return "bg-gradient-to-b from-slate-200 to-slate-300/80 border-slate-300/50 border-l-slate-400 text-slate-800 dark:from-slate-500/25 dark:to-slate-700/15 dark:border-slate-500/20 dark:border-l-slate-400 dark:text-slate-200";
      case "embed":
        return "bg-gradient-to-b from-red-200 to-red-300/80 border-red-300/60 border-l-red-500 text-red-900 dark:from-red-500/30 dark:to-red-700/18 dark:border-red-500/25 dark:border-l-red-400 dark:text-red-100";
      case "ul":
        return "bg-gradient-to-b from-amber-200 to-amber-300/80 border-amber-300/60 border-l-amber-500 text-amber-900 dark:from-amber-500/30 dark:to-amber-700/18 dark:border-amber-500/25 dark:border-l-amber-400 dark:text-amber-100";
      default:
        return "bg-gradient-to-b from-gray-200 to-gray-300/80 border-gray-300/60 border-l-gray-400 text-gray-900 dark:from-gray-500/25 dark:to-gray-700/15 dark:border-gray-500/20 dark:border-l-gray-400 dark:text-gray-200";
    }
  };

  return (
    <div
      style={{
        left: `${left}px`,
        width: `${Math.max(20, width - 1)}px`, // Reduced gap between clips
        minWidth: "20px",
      }}
      className={`clip border ${getClipColor()} px-2 py-0.5 text-xs font-medium overflow-hidden shadow-sm hover:shadow hover:brightness-[0.97] dark:hover:brightness-110 transition-all duration-150 cursor-pointer flex items-center select-none`}
      title={`${item.name} (${item.start}ms - ${item.end}ms)`}
    >
      <ClipIcon type={item.type} />
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