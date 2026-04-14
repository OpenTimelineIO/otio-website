"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Playhead from "@/components/nle/playhead";
import Draggable from "react-draggable";
import Timecode from "smpte-timecode";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutDisplay } from "@/components/nle/keyboard-shortcut-display";
import { ScrollContext } from "@/components/nle/scroll-context";
import { TimelineTicks } from "@/components/nle/timeline-ticks";
import { Play, Pause, FastForward, Rewind, Monitor, Eye, ZoomIn, ZoomOut, Heading1, Heading2, Heading3, Image, AlignLeft, List, Video } from "lucide-react";
import { ContentRenderer } from "@/components/nle/content-renderer";
import { Sequence } from "@/components/nle/sequence";
import { SequenceSelector } from "@/components/nle/sequence-selector";
import { parseMarkdownToClips } from "@/components/nle/utils/markdown-parser";
import { msToFrames, percentageToMs } from "@/lib/time-utils";
import "@/styles/nle.css";

const EditorialInterfaceComponent = ({ markdown }: { markdown: string }) => {
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [ffwState, setFfwState] = useState(false);
  const [rewindState, setRewindState] = useState(false);
  
  // Refs to track current state for keyboard handler (avoids stale closures)
  const ffwStateRef = useRef(ffwState);
  const rewindStateRef = useRef(rewindState);
  
  // Keep refs in sync with state
  useEffect(() => {
    ffwStateRef.current = ffwState;
  }, [ffwState]);
  
  useEffect(() => {
    rewindStateRef.current = rewindState;
  }, [rewindState]);
  const [ffwSpeedLevel, setFfwSpeedLevel] = useState(0);
  const [rewindSpeedLevel, setRewindSpeedLevel] = useState(0);
  const [currentKeyCode, setCurrentKeyCode] = useState("");
  const [currentShiftKey, setCurrentShiftKey] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.5 = 50%, 2 = 200%
  const [timelineHeight, setTimelineHeight] = useState(2000); // Default playhead height - will be adjusted dynamically
  const [timelineWidth, setTimelineWidth] = useState(2000); // Timeline content width
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0); // Track horizontal scroll position
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false); // Trigger auto-scroll after position updates
  const [containerWidth, setContainerWidth] = useState(0); // Track the viewport width of timeline container
  const timelineTicksRef = useRef<HTMLDivElement>(null);

  // Parse markdown and generate clips
  const { clips, totalDuration, sections } = useMemo(() => {
    try {
      return parseMarkdownToClips(markdown);
    } catch (error) {
      return { clips: [], totalDuration: 60000, sections: [] }; // Default 60s
    }
  }, [markdown]);

  // Convert total duration from milliseconds to seconds for timeline calculations
  const timelineDuration = totalDuration / 1000; // seconds
  const timelineDurationFrames = msToFrames(totalDuration);
  const percentagePerSecond = timelineDuration > 0 ? 1 / timelineDuration : 0;

  // Calculate the base timeline width (at 100% zoom) - must match Sequence component
  const baseTimelineWidth = useMemo(() => {
    return Math.max(2000, (totalDuration / 1000) * 50 * 1.1);
  }, [totalDuration]);

  // Calculate the actual timeline content width based on zoom level
  // This is used for TimelineTicks to ensure immediate updates when zooming
  const calculatedTimelineWidth = useMemo(() => {
    return baseTimelineWidth * zoomLevel;
  }, [baseTimelineWidth, zoomLevel]);

  // Calculate minimum zoom level that fills the container exactly
  const minZoomLevel = useMemo(() => {
    if (containerWidth <= 0 || baseTimelineWidth <= 0) return 0.25; // fallback
    return containerWidth / baseTimelineWidth;
  }, [containerWidth, baseTimelineWidth]);

  // Constrained zoom setter that respects the calculated minimum
  const setConstrainedZoom = useCallback((updater: number | ((prev: number) => number)) => {
    setZoomLevel((prev) => {
      const newValue = typeof updater === 'function' ? updater(prev) : updater;
      // Clamp between minZoomLevel and 4 (400%)
      return Math.max(minZoomLevel, Math.min(4, newValue));
    });
  }, [minZoomLevel]);

  // Adjust zoom level if it falls below the new minimum (e.g., on window resize)
  useEffect(() => {
    if (zoomLevel < minZoomLevel) {
      setZoomLevel(minZoomLevel);
    }
  }, [minZoomLevel, zoomLevel]);

  // Derive playhead position from scroll percentage and calculated timeline width.
  // Uses calculatedTimelineWidth (computed synchronously from state) instead of
  // timelineWidth (updated async by ResizeObserver) to stay in sync after zoom changes.
  const playheadPosition = scrollPercentage * calculatedTimelineWidth;

  const verticalSectionRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  const getTimecodeFromScroll = useCallback(
    (percentage: number) => {
      try {
        // Convert percentage to milliseconds, then to frames
        const currentMs = percentageToMs(percentage, totalDuration);
        const currentFrame = msToFrames(currentMs);

        // Create timecode from frame count
        const tc = new Timecode(currentFrame, 24, false);

        return tc.toString();
      } catch (error) {
        return "00:00:00;00";
      }
    },
    [totalDuration]
  );

  const getTimelineDurationTimecode = useCallback(() => {
    try {
      // Create timecode from frame count
      const tc = new Timecode(timelineDurationFrames, 24, false);
      return tc.toString();
    } catch (error) {
      return "00:00:00;00";
    }
  }, [timelineDurationFrames]);

  // REMOVED: Duplicate animation loop - now handled by unified animation effect below

  // Update the scroll sync effect to handle vertical scrolling only
  // Use RAF for smoother updates synchronized with browser paint
  useEffect(() => {
    if (isScrolling) return; // Skip if user is manually scrolling

    const verticalSection = verticalSectionRef.current;

    if (verticalSection) {
      // Use RAF to sync with browser paint cycle for smoother scrolling
      requestAnimationFrame(() => {
        if (!verticalSection) return;
        
        // Calculate target scroll position
        const verticalScrollMax =
          verticalSection.scrollHeight - verticalSection.clientHeight;
        const targetScroll = scrollPercentage * verticalScrollMax;
        
        // Update scroll position - let browser handle sub-pixel rendering
        verticalSection.scrollTop = targetScroll;
      });
    }
  }, [scrollPercentage, isScrolling]);

  // Update the handleScroll callback - vertical scrolling only
  const handleScroll = useCallback(
    (e: any) => {
      if (isPlaying || ffwState || rewindState) {
        setIsPlaying(false);
        setFfwState(false);
        setRewindState(false);
        return;
      }

      const verticalSection = verticalSectionRef.current;

      if (verticalSection && e.target === verticalSection) {
        setIsScrolling(true);
        let newScrollPercentage;

        newScrollPercentage =
          verticalSection.scrollTop /
          (verticalSection.scrollHeight - verticalSection.clientHeight);

        if (newScrollPercentage !== undefined) {
          // Clamp the scroll percentage between 0 and 1
          newScrollPercentage = Math.max(0, Math.min(1, newScrollPercentage));
          // Round to 4 decimal places to prevent floating point errors
          newScrollPercentage = Math.round(newScrollPercentage * 10000) / 10000;
        }
        setIsScrolling(false);
      }
    },
    [isPlaying, ffwState, rewindState]
  );

  // Update scroll event listeners
  // useEffect(() => {
  //   const verticalSection = verticalSectionRef.current;
  //   const horizontalSection = timelineWrapperRef.current;

  //   if (verticalSection && horizontalSection) {
  //     verticalSection.addEventListener('scroll', handleScroll);
  //     horizontalSection.addEventListener('scroll', handleScroll);
  //   }

  //   return () => {
  //     if (verticalSection) {
  //       verticalSection.removeEventListener('scroll', handleScroll);
  //     }
  //     if (horizontalSection) {
  //       horizontalSection.removeEventListener('scroll', handleScroll);
  //     }
  //   };
  // }, [handleScroll]);

  // ResizeObserver - track both scroll width (content) and client width (viewport)
  useEffect(() => {
    const updateTimelineDimensions = () => {
      if (timelineWrapperRef.current) {
        const width = timelineWrapperRef.current.scrollWidth;
        const viewportWidth = timelineWrapperRef.current.clientWidth;
        setTimelineWidth(width);
        setContainerWidth(viewportWidth);
        
        // Calculate playhead height: ticks (32px) + tracks (7 × 32px = 224px) = 256px
        const ticksHeight = 32;
        const tracksHeight = 7 * 32;
        const totalHeight = ticksHeight + tracksHeight;
        setTimelineHeight(totalHeight);
      }
    };

    const resizeObserver = new ResizeObserver(updateTimelineDimensions);
    if (timelineWrapperRef.current) {
      resizeObserver.observe(timelineWrapperRef.current);
    }

    // Also run once immediately to get initial dimensions
    updateTimelineDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, [zoomLevel]); // Only re-create when zoom changes

  // Handle seeking to a specific timeline position
  const handleSeek = useCallback((percentage: number) => {
    // Stop playback
    setIsPlaying(false);
    setFfwState(false);
    setRewindState(false);

    setScrollPercentage(percentage);
  }, []);

  // Helper function to ensure playhead is visible in viewport
  const scrollPlayheadIntoView = useCallback(() => {
    if (!timelineWrapperRef.current) return;
    
    const viewportWidth = timelineWrapperRef.current.clientWidth;
    const currentScrollLeft = timelineWrapperRef.current.scrollLeft;
    const playheadVisualPosition = playheadPosition - currentScrollLeft;
    
    // If playhead is behind the left edge or too close, scroll it into view
    if (playheadVisualPosition < 100) {
      const newScrollLeft = Math.max(0, playheadPosition - 100);
      timelineWrapperRef.current.scrollLeft = newScrollLeft;
      if (timelineTicksRef.current) {
        timelineTicksRef.current.scrollLeft = newScrollLeft;
      }
    }
    // If playhead is past the right edge, scroll it into view
    else if (playheadVisualPosition > viewportWidth - 50) {
      const newScrollLeft = playheadPosition - viewportWidth + 100;
      timelineWrapperRef.current.scrollLeft = newScrollLeft;
      if (timelineTicksRef.current) {
        timelineTicksRef.current.scrollLeft = newScrollLeft;
      }
    }
  }, [playheadPosition]);

  // Auto-scroll effect when shouldAutoScroll flag is set
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollPlayheadIntoView();
      setShouldAutoScroll(false);
    }
  }, [shouldAutoScroll, playheadPosition, scrollPlayheadIntoView]);

  // Get track header width from CSS variable (use state to avoid hydration mismatch)
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(120);
  
  useEffect(() => {
    const width = getComputedStyle(document.documentElement)
      .getPropertyValue('--track-header-width')
      .trim();
    const parsedWidth = parseInt(width) || 120;
    if (parsedWidth !== trackHeaderWidth) {
      setTrackHeaderWidth(parsedWidth);
    }
  }, []);

  const handlePlayheadDrag = useCallback((e: any) => {
    setIsPlaying(false);
    setFfwState(false);
    setRewindState(false);

    if (!timelineWrapperRef.current) return;

    // Compute position directly from the mouse event relative to the timeline wrapper,
    // bypassing react-draggable's internal coordinate tracking which can drift.
    const wrapperRect = timelineWrapperRef.current.getBoundingClientRect();
    const posInContent = e.clientX - wrapperRect.left + timelineWrapperRef.current.scrollLeft;
    const newPercentage = Math.max(0, Math.min(1, posInContent / calculatedTimelineWidth));

    setScrollPercentage(newPercentage);

    // Auto-scroll timeline if playhead is dragged near edges
    const viewportWidth = timelineWrapperRef.current.clientWidth;
    const currentScrollLeft = timelineWrapperRef.current.scrollLeft;
    const playheadVisualPosition = posInContent - currentScrollLeft;

    if (playheadVisualPosition < 50 && currentScrollLeft > 0) {
      const newScrollLeft = Math.max(0, posInContent - 100);
      timelineWrapperRef.current.scrollLeft = newScrollLeft;
      if (timelineTicksRef.current) {
        timelineTicksRef.current.scrollLeft = newScrollLeft;
      }
    } else if (playheadVisualPosition > viewportWidth - 50) {
      const newScrollLeft = posInContent - viewportWidth + 100;
      timelineWrapperRef.current.scrollLeft = newScrollLeft;
      if (timelineTicksRef.current) {
        timelineTicksRef.current.scrollLeft = newScrollLeft;
      }
    }
  }, [calculatedTimelineWidth]);

  // Handle click-to-snap on the timeline track area: snap playhead on mousedown,
  // then follow through with drag via document-level mousemove/mouseup.
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left clicks, and ignore clicks on the playhead itself
    if (e.button !== 0) return;
    if (playheadRef.current && playheadRef.current.contains(e.target as Node)) return;

    e.preventDefault();
    setIsPlaying(false);
    setFfwState(false);
    setRewindState(false);

    if (!timelineWrapperRef.current) return;

    const computePercentage = (clientX: number) => {
      const wrapperRect = timelineWrapperRef.current!.getBoundingClientRect();
      const posInContent = clientX - wrapperRect.left + timelineWrapperRef.current!.scrollLeft;
      return Math.max(0, Math.min(1, posInContent / calculatedTimelineWidth));
    };

    // Snap to click position immediately
    setScrollPercentage(computePercentage(e.clientX));

    const onMouseMove = (moveEvent: MouseEvent) => {
      setScrollPercentage(computePercentage(moveEvent.clientX));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [calculatedTimelineWidth]);

  // Update keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      // Check if DocSearch modal is open - if so, don't process any shortcuts
      const docSearchModal = document.querySelector('.DocSearch-Modal');
      const isDocSearchOpen = docSearchModal !== null;
      
      // Also check if any input/textarea has focus (prevents shortcuts when typing)
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isDocSearchOpen || isInputFocused) {
        return; // Don't process shortcuts when DocSearch is open or typing in an input
      }

      // Ignore shortcuts when Cmd/Ctrl is pressed (except zoom shortcuts)
      // This allows DocSearch (Cmd+K) and other browser shortcuts to work
      if (e.metaKey || e.ctrlKey) {
        // Only handle zoom shortcuts
        if (e.code === "Equal" || e.code === "Minus") {
          e.preventDefault();
          if (e.code === "Equal") {
            // Zoom in
            setConstrainedZoom((prev) => prev + 0.25);
          } else if (e.code === "Minus") {
            // Zoom out
            setConstrainedZoom((prev) => prev - 0.25);
          }
        }
        return; // Don't process any other shortcuts when Cmd/Ctrl is pressed
      }

      // Update shortcut display state (only for non-modifier key presses)
      setCurrentKeyCode(e.code);
      setCurrentShiftKey(e.shiftKey);

      // Reset after a short delay
      setTimeout(() => {
        setCurrentKeyCode("");
        setCurrentShiftKey(false);
      }, 150);

      if (e.code === "Space") {
        e.preventDefault();
        if (document.activeElement === playButtonRef.current) {
          playButtonRef.current?.blur();
        }
      }

      switch (e.code) {
        case "KeyK":
        case "Space": {
          e.preventDefault();
          // Use refs to get current state (avoids stale closure issues)
          if (ffwStateRef.current || rewindStateRef.current) {
            // Return to standard playback speed and stop
            scrollPlayheadIntoView();
            setIsPlaying(false);
            setFfwState(false);
            setRewindState(false);
            setFfwSpeedLevel(0);
            setRewindSpeedLevel(0);
          } else {
            // Normal toggle play/pause
            setIsPlaying((prev) => {
              if (!prev) {
                // About to start playing, ensure playhead is visible
                scrollPlayheadIntoView();
              }
              return !prev;
            });
          }
          if (playButtonRef.current) {
            playButtonRef.current.blur();
          }
          break;
        }
        case "KeyL":
          scrollPlayheadIntoView();
          setIsPlaying(false);
          setRewindState(false);
          setRewindSpeedLevel(0);
          if (ffwStateRef.current) {
            setFfwSpeedLevel((prev) => Math.min(prev + 1, 4));
          } else {
            setFfwState(true);
            setFfwSpeedLevel(1);
          }
          break;
        case "KeyJ":
          scrollPlayheadIntoView();
          setIsPlaying(false);
          setFfwState(false);
          setFfwSpeedLevel(0);
          if (rewindStateRef.current) {
            setRewindSpeedLevel((prev) => Math.min(prev + 1, 4));
          } else {
            setRewindState(true);
            setRewindSpeedLevel(1);
          }
          break;
        case "KeyI":
          if (e.shiftKey) {
            setIsPlaying(false);
            setFfwState(false);
            setRewindState(false);
            setScrollPercentage(0);
            setShouldAutoScroll(true);
          }
          break;
        case "KeyO":
          if (e.shiftKey) {
            setIsPlaying(false);
            setFfwState(false);
            setRewindState(false);
            setScrollPercentage(1);
            setShouldAutoScroll(true);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          setScrollPercentage((prev) => {
            const framesPerJump = e.shiftKey ? 24 : 1;
            const percentPerFrame = 1 / timelineDurationFrames;
            const increment = percentPerFrame * framesPerJump;
            return Math.min(1, prev + increment);
          });
          break;
        case "ArrowLeft":
          e.preventDefault();
          setScrollPercentage((prev) => {
            const framesPerJump = e.shiftKey ? 24 : 1;
            const percentPerFrame = 1 / timelineDurationFrames;
            const increment = percentPerFrame * framesPerJump;
            return Math.max(0, prev - increment);
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setIsPlaying(false);
          setFfwState(false);
          setRewindState(false);
          setScrollPercentage(0);
          setShouldAutoScroll(true);
          break;
        case "ArrowDown":
          e.preventDefault();
          setIsPlaying(false);
          setFfwState(false);
          setRewindState(false);
          setScrollPercentage(1);
          setShouldAutoScroll(true);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timelineDurationFrames, scrollPlayheadIntoView, setConstrainedZoom]);

  // Update playback animation with proper delta time for smooth scrolling
  useEffect(() => {
    let animationId: number | null = null;
    let lastTimestamp: number | null = null;
    
    const getSpeedMultiplier = () => {
      if (ffwState) {
        return Math.pow(2, ffwSpeedLevel + 1); // 2x, 4x, 8x
      }
      if (rewindState) {
        return Math.pow(2, rewindSpeedLevel + 1); // 2x, 4x, 8x
      }
      return 1;
    };

    const animate = (timestamp: number) => {
      // Initialize lastTimestamp on first frame
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        animationId = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time in seconds
      const deltaTime = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      let hitBounds = false;

      setScrollPercentage((prev) => {
        let newPercentage = prev;
        const speedMultiplier = getSpeedMultiplier();

        if (isPlaying) {
          newPercentage += percentagePerSecond * deltaTime;
        } else if (ffwState) {
          newPercentage += (percentagePerSecond * speedMultiplier) * deltaTime;
        } else if (rewindState) {
          newPercentage -= (percentagePerSecond * speedMultiplier) * deltaTime;
        } else {
          return prev;
        }

        // Clamp between 0 and 1
        newPercentage = Math.max(0, Math.min(1, newPercentage));

        if (newPercentage >= 1 || newPercentage <= 0) {
          hitBounds = true;
        }

        return newPercentage;
      });

      // Stop playback outside the updater to avoid cascading state updates
      if (hitBounds) {
        setIsPlaying(false);
        setFfwState(false);
        setRewindState(false);
        return; // Don't schedule next frame
      }

      animationId = requestAnimationFrame(animate);
    };

    if (isPlaying || ffwState || rewindState) {
      animationId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      lastTimestamp = null;
    };
  }, [
    isPlaying,
    ffwState,
    rewindState,
    percentagePerSecond,
    ffwSpeedLevel,
    rewindSpeedLevel,
  ]);

  const sequences = [
    { id: "introduction", name: "OTIO_Introduction_v01.otio" },
    { id: "for-editors", name: "OTIO_for_editors_v01.otio" },
    { id: "for-developers", name: "OTIO_for_developers_v01.otio" },
  ];

  return (
    <div className="editorContainer">
      <ScrollContext.Provider value={scrollPercentage}>
        <div className="uiContainer">
          <div ref={verticalSectionRef} className="programMonitor">
            {/* <div className="programMonitorHeader">
              <SequenceSelector
                sequences={sequences}
                activeSequenceId={"introduction"}
                onSequenceChange={function (sequenceId: string): void {
                  throw new Error("Function not implemented.");
                }}
              />
            </div> */}
            <ContentRenderer
              markdown={markdown}
              sections={sections}
              currentTimeMs={0}
              syncWithPlayhead={false}
            />
          </div>
          <KeyboardShortcutDisplay
            keyCode={currentKeyCode}
            shiftKey={currentShiftKey}
            isPlaying={isPlaying}
            ffwSpeedLevel={ffwSpeedLevel}
            rewindSpeedLevel={rewindSpeedLevel}
            ffwState={ffwState}
            rewindState={rewindState}
          />
          <div className="transportControls">
            <div className="flex justify-start items-center">
              <div className="timecodeDisplay">
                {getTimecodeFromScroll(scrollPercentage)}
              </div>
            </div>
            <div className="playbackControlsButtonWrapper">
              <Button
                className="playbackControlButton"
                variant="ghost"
                onClick={() => {
                  scrollPlayheadIntoView();
                  setIsPlaying(false);
                  setFfwState(false);
                  setFfwSpeedLevel(0);
                  if (rewindState) {
                    setRewindSpeedLevel((prev) => Math.min(prev + 1, 4));
                  } else {
                    setRewindState(true);
                    setRewindSpeedLevel(1);
                  }
                }}
                data-active={rewindState ? "true" : undefined}
              >
                <Rewind size={15} />
              </Button>
              <Button
                ref={playButtonRef}
                className="playbackControlButton"
                variant="ghost"
                onClick={() => {
                  if (ffwState || rewindState) {
                    scrollPlayheadIntoView();
                    setIsPlaying(false);
                    setFfwState(false);
                    setRewindState(false);
                  } else {
                    setIsPlaying((prev) => {
                      if (!prev) {
                        scrollPlayheadIntoView();
                      }
                      return !prev;
                    });
                  }
                }}
                data-active={isPlaying ? "true" : undefined}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </Button>
              <Button
                className="playbackControlButton"
                variant="ghost"
                onClick={() => {
                  scrollPlayheadIntoView();
                  setIsPlaying(false);
                  setRewindState(false);
                  setRewindSpeedLevel(0);
                  if (ffwState) {
                    setFfwSpeedLevel((prev) => Math.min(prev + 1, 4));
                  } else {
                    setFfwState(true);
                    setFfwSpeedLevel(1);
                  }
                }}
                data-active={ffwState ? "true" : undefined}
              >
                <FastForward size={15} />
              </Button>
            </div>
            <div className="transportControlsRight">
              <div className="zoomControls">
                <span className="text-xs text-muted-foreground mr-2">Zoom:</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setConstrainedZoom((prev) => prev - 0.25)}
                  disabled={zoomLevel <= minZoomLevel}
                  title="Zoom Out (Cmd/Ctrl + -)"
                >
                  <ZoomOut size={14} />
                </Button>
                <button
                  className="text-xs mx-1 min-w-10 text-center hover:underline cursor-pointer"
                  onClick={() => setConstrainedZoom(1)}
                  title="Reset Zoom (100%)"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setConstrainedZoom((prev) => prev + 0.25)}
                  disabled={zoomLevel >= 4}
                  title="Zoom In (Cmd/Ctrl + +)"
                >
                  <ZoomIn size={14} />
                </Button>
              </div>
              <div className="timecodeDisplay">
                {getTimelineDurationTimecode()}
              </div>
            </div>
          </div>
          <div ref={timelineContainerRef} className="timelineWrapperContainer">
            {/* Ticks ruler row */}
            <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
              {/* Spacer for track headers */}
              <div className="track-headers-spacer" />
              
              {/* Timeline ticks ruler */}
              <div
                ref={timelineTicksRef}
                className="timelineTicksWrapper"
                style={{
                  overflowX: 'scroll',
                  overflowY: 'hidden',
                  height: '32px',
                  flex: 1,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                onScroll={(e) => {
                  // Sync ticks scroll with timeline
                  if (timelineWrapperRef.current) {
                    timelineWrapperRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              >
                <TimelineTicks 
                  totalDurationMs={totalDuration} 
                  zoomLevel={zoomLevel}
                  timelineWidth={calculatedTimelineWidth}
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* Track headers and timeline row */}
            <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
              {/* Fixed track headers column */}
              <div className="track-headers-fixed">
                <div className="track-header">
                  <div className="track-label" data-track="h1"><Heading1 size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="h2"><Heading2 size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="h3"><Heading3 size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="img"><Image size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="p"><AlignLeft size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="ul"><List size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
                <div className="track-header">
                  <div className="track-label" data-track="embed"><Video size={14} strokeWidth={2} /></div>
                  <div className="track-controls">
                    <button><Monitor size={14} /></button>
                    <button><Eye size={14} /></button>
                  </div>
                </div>
              </div>
            
              {/* Scrollable timeline area */}
              <div
                id="timelineWrapper"
                ref={timelineWrapperRef}
                className="timelineWrapper"
                onMouseDown={handleTimelineMouseDown}
                onScroll={(e) => {
                  // Sync timeline scroll with ticks
                  if (timelineTicksRef.current) {
                    timelineTicksRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                  // Track scroll position for playhead
                  setTimelineScrollLeft(e.currentTarget.scrollLeft);
                }}
              >
                <Sequence clips={clips} totalDurationMs={totalDuration} zoomLevel={zoomLevel} />
              </div>
            </div>

            {/* Playhead - positioned absolutely over the entire timeline */}
            <Draggable
              key={calculatedTimelineWidth}
              nodeRef={playheadRef}
              axis="x"
              position={{ x: playheadPosition, y: 0 }}
              onDrag={handlePlayheadDrag}
              bounds={{
                left: 0,
                right: calculatedTimelineWidth - 2,
              }}
            >
              <div
                ref={playheadRef}
                className="playheadContainer"
                style={{
                  position: "absolute",
                  left: `${trackHeaderWidth - timelineScrollLeft}px`, // Offset for track headers and account for scroll
                  top: 0, // Start at the top of ticks
                  height: "100%",
                  zIndex: 1200,
                  cursor: "ew-resize",
                  pointerEvents: "auto",
                }}
              >
                <Playhead height={timelineHeight} />
              </div>
            </Draggable>
          </div>
        </div>
      </ScrollContext.Provider>
    </div>
  );
};

export { EditorialInterfaceComponent };
