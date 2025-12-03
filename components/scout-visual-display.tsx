"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Globe, Search, FileText, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import CurvyRect, { Connector } from "@/components/shared/layout/curvy-rect";

// Simple markdown renderer component
function MarkdownRenderer({ content }: { content: string }) {
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactElement[] = [];
    let currentList: string[] = [];
    let listType: "ul" | "ol" | null = null;

    const flushList = (index: number) => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag
            key={`list-${index}`}
            className="list-disc list-inside space-y-8 my-16 text-body-medium text-black-alpha-72"
          >
            {currentList.map((item, i) => (
              <li
                key={i}
                dangerouslySetInnerHTML={{ __html: formatInline(item) }}
              />
            ))}
          </ListTag>,
        );
        currentList = [];
        listType = null;
      }
    };

    const formatInline = (text: string) => {
      return text
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-heat-100 hover:underline">$1</a>',
        )
        .replace(
          /\*\*([^*]+)\*\*/g,
          '<strong class="text-accent-black">$1</strong>',
        )
        .replace(
          /__([^_]+)__/g,
          '<strong class="text-accent-black">$1</strong>',
        )
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/_([^_]+)_/g, "<em>$1</em>")
        .replace(
          /`([^`]+)`/g,
          '<code class="bg-black-alpha-4 px-6 py-2 rounded-4 text-mono-small font-mono">$1</code>',
        );
    };

    lines.forEach((line, index) => {
      if (line.startsWith("### ")) {
        flushList(index);
        elements.push(
          <h3
            key={index}
            className="text-body-large font-semibold text-accent-black mt-20 mb-8"
          >
            {line.slice(4)}
          </h3>,
        );
      } else if (line.startsWith("## ")) {
        flushList(index);
        elements.push(
          <h2
            key={index}
            className="text-body-x-large font-semibold text-accent-black mt-24 mb-12"
          >
            {line.slice(3)}
          </h2>,
        );
      } else if (line.startsWith("# ")) {
        flushList(index);
        elements.push(
          <h1
            key={index}
            className="text-title-h5 font-semibold text-accent-black mt-32 mb-16"
          >
            {line.slice(2)}
          </h1>,
        );
      } else if (line.match(/^[\-\*]\s+/)) {
        if (listType !== "ul") {
          flushList(index);
          listType = "ul";
        }
        currentList.push(line.replace(/^[\-\*]\s+/, ""));
      } else if (line.match(/^\d+\.\s+/)) {
        if (listType !== "ol") {
          flushList(index);
          listType = "ol";
        }
        currentList.push(line.replace(/^\d+\.\s+/, ""));
      } else if (line.trim() === "") {
        flushList(index);
        if (
          elements.length > 0 &&
          elements[elements.length - 1]?.type !== "br"
        ) {
          elements.push(<br key={index} />);
        }
      } else {
        flushList(index);
        elements.push(
          <p
            key={index}
            className="text-body-medium text-black-alpha-72 leading-relaxed my-8"
            dangerouslySetInnerHTML={{ __html: formatInline(line) }}
          />,
        );
      }
    });

    flushList(lines.length);
    return elements;
  };

  return <div className="markdown-content">{renderMarkdown(content)}</div>;
}

// Favicon component with Google favicon service fallback
function Favicon({
  src,
  url,
}: {
  src: string | null | undefined;
  url?: string;
}) {
  const [hasError, setHasError] = useState(false);

  // Extract top-level domain from URL for Google favicon service
  const getFaviconUrl = (pageUrl: string) => {
    try {
      const urlObj = new URL(pageUrl);
      const domain = urlObj.hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const fallbackSrc = url ? getFaviconUrl(url) : null;

  if (!src && !fallbackSrc) {
    return <Globe className="w-[18px] h-[18px] text-black-alpha-40" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hasError && fallbackSrc ? fallbackSrc : src || fallbackSrc || ""}
      alt=""
      className="w-full h-full rounded-sm object-contain"
      onError={() => setHasError(true)}
    />
  );
}

interface SearchResult {
  title: string;
  url: string;
  description?: string;
  markdown?: string;
  publishedTime?: string;
  favicon?: string | null;
}

interface ExecutionStep {
  id: string;
  step_number: number;
  step_type: "search" | "scrape" | "analyze" | "summarize" | "tool_call";
  description: string;
  input_data: unknown;
  output_data: unknown;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
}

interface ScoutVisualDisplayProps {
  steps: ExecutionStep[];
  isActive: boolean;
  replayMode?: boolean;
  onCurrentStepChange?: (stepIndex: number) => void;
}

export function ScoutVisualDisplay({
  steps,
  isActive,
  replayMode = false,
  onCurrentStepChange,
}: ScoutVisualDisplayProps) {
  void isActive; // Unused but part of the props interface
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(
    null,
  );
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [isImageTall, setIsImageTall] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isScrapingWithoutScreenshot, setIsScrapingWithoutScreenshot] =
    useState(false);
  const isViewLockedRef = useRef(false);

  // Replay mode states
  const [isTypingQuery, setIsTypingQuery] = useState(false);
  const [isShowingSkeleton, setIsShowingSkeleton] = useState(false);
  const [typedQuery, setTypedQuery] = useState("");

  // Summary typing states
  const [isTypingSummary, setIsTypingSummary] = useState(false);
  const [typedSummary, setTypedSummary] = useState("");

  const screenshotRef = useRef<HTMLImageElement>(null);
  const viewLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isReplayRunningRef = useRef(false);
  const advanceReplayRef = useRef<(() => void) | null>(null);

  // Replay simulation for completed executions
  useEffect(() => {
    if (replayMode && steps.length > 0 && !isReplayRunningRef.current) {
      // Mark replay as running to prevent restarts
      isReplayRunningRef.current = true;

      // Clear any existing replay timer
      if (replayIntervalRef.current) {
        clearTimeout(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }

      // Start at first valid step (non-tool_call)
      const firstValidIndex = steps.findIndex(
        (s) => s.step_type !== "tool_call",
      );
      setCurrentStepIndex(firstValidIndex !== -1 ? firstValidIndex : 0);

      let stepIndex = firstValidIndex !== -1 ? firstValidIndex : 0;
      const timeouts: NodeJS.Timeout[] = [];

      const scheduleTimeout = (fn: () => void, delay: number) => {
        const timeout = setTimeout(fn, delay);
        timeouts.push(timeout);
        return timeout;
      };

      const animateSearchStep = (
        currentStep: ExecutionStep,
        onComplete: () => void,
      ) => {
        const query =
          (currentStep.input_data as { query?: string })?.query || "";

        // Phase 1: Show typing animation (1s)
        setIsTypingQuery(true);
        setIsShowingSkeleton(false);
        setTypedQuery("");

        // Simulate typing
        const typingDuration = 1000;
        const chars = query.split("");
        const charDelay = typingDuration / Math.max(chars.length, 1);

        chars.forEach((char: string, index: number) => {
          scheduleTimeout(() => {
            setTypedQuery(query.substring(0, index + 1));
          }, charDelay * index);
        });

        // Phase 2: Show skeleton (1s after typing starts)
        scheduleTimeout(() => {
          setIsTypingQuery(false);
          setIsShowingSkeleton(true);
        }, 1000);

        // Phase 3: Show results (1s after skeleton)
        scheduleTimeout(() => {
          setIsShowingSkeleton(false);
        }, 2000);

        // Phase 4: Wait 2s then advance (2s after results show)
        scheduleTimeout(() => {
          onComplete();
        }, 4000);
      };

      const animateScrapeStep = (
        currentStep: ExecutionStep,
        onComplete: () => void,
      ) => {
        // Get the URL being scraped and find its index in search results
        const scrapedUrl =
          (currentStep.output_data as { url?: string })?.url ||
          (currentStep.input_data as { url?: string })?.url;
        const searchStep = steps
          .slice(0, stepIndex + 1)
          .reverse()
          .find((s) => s.step_type === "search" && s.status !== "failed");
        const searchResults = ((
          searchStep?.output_data as {
            searchResults?: SearchResult[];
            results?: SearchResult[];
          }
        )?.searchResults ||
          (
            searchStep?.output_data as {
              searchResults?: SearchResult[];
              results?: SearchResult[];
            }
          )?.results ||
          []) as SearchResult[];
        const resultIndex = searchResults.findIndex(
          (r: SearchResult) => r.url === scrapedUrl,
        );

        // Phase 1: Show skeleton for 1s
        setActiveResultIndex(-1); // Don't highlight any result during skeleton
        setIsScrapingWithoutScreenshot(true);
        setShowScreenshot(false);
        setCurrentScreenshot(null);

        // Phase 2: Show screenshot with scanning for 4s (after 1s)
        scheduleTimeout(() => {
          setIsScrapingWithoutScreenshot(false);

          // Set the active result index when we start showing the screenshot
          setActiveResultIndex(resultIndex);

          // Check if we have a screenshot
          if (
            (currentStep.output_data as { screenshot?: string })?.screenshot
          ) {
            setIsImageLoaded(false);
            setIsImageTall(false);
            setCurrentScreenshot(
              (currentStep.output_data as { screenshot: string }).screenshot,
            );
            setShowScreenshot(true);
          }
        }, 1000);

        // Phase 3: Advance to next step (after 5s total: 1s skeleton + 4s scanning)
        scheduleTimeout(() => {
          onComplete();
        }, 5000);
      };

      const animateSummaryStep = (
        currentStep: ExecutionStep,
        onComplete: () => void,
      ) => {
        const summary =
          (currentStep.output_data as { response?: string })?.response || "";

        // Phase 1: Start typing animation
        setIsTypingSummary(true);
        setTypedSummary("");

        // Simulate typing with faster speed for longer text
        const typingDuration = Math.min(
          3000,
          Math.max(1500, summary.length * 15),
        );
        const chars = summary.split("");
        const charDelay = typingDuration / Math.max(chars.length, 1);

        chars.forEach((char: string, index: number) => {
          scheduleTimeout(() => {
            setTypedSummary(summary.substring(0, index + 1));
          }, charDelay * index);
        });

        // Phase 2: Stop typing and show complete summary (after typing finishes)
        scheduleTimeout(() => {
          setIsTypingSummary(false);
        }, typingDuration);

        // Phase 3: Wait 2s then advance
        scheduleTimeout(() => {
          onComplete();
        }, typingDuration + 2000);
      };

      const advanceToNextStep = () => {
        // Get current step to determine animation type
        const currentStep = steps[stepIndex];

        if (currentStep.step_type === "search") {
          // Animate search step
          animateSearchStep(currentStep, () => {
            // After animation completes, move to next step
            proceedToNextStep();
          });
        } else if (currentStep.step_type === "scrape") {
          // Animate scrape step (handles activeResultIndex internally)
          animateScrapeStep(currentStep, () => {
            // After animation completes, move to next step
            proceedToNextStep();
          });
        } else if (currentStep.step_type === "summarize") {
          // Animate summary step
          animateSummaryStep(currentStep, () => {
            // After animation completes, move to next step
            proceedToNextStep();
          });
        } else {
          // For other step types, just advance normally
          scheduleTimeout(() => {
            proceedToNextStep();
          }, 1500);
        }
      };

      const proceedToNextStep = () => {
        // Reset animation states
        setIsTypingQuery(false);
        setIsShowingSkeleton(false);
        setTypedQuery("");
        setIsScrapingWithoutScreenshot(false);
        setShowScreenshot(false);
        setActiveResultIndex(-1);
        setIsTypingSummary(false);
        setTypedSummary("");

        // Find next valid step (skip tool_call and failed steps)
        let nextIndex = stepIndex + 1;
        while (
          nextIndex < steps.length &&
          (steps[nextIndex].step_type === "tool_call" ||
            steps[nextIndex].status === "failed")
        ) {
          nextIndex++;
        }

        if (nextIndex < steps.length) {
          stepIndex = nextIndex;
          setCurrentStepIndex(nextIndex);

          // Continue the animation sequence
          advanceToNextStep();
        } else {
          // Replay finished
          isReplayRunningRef.current = false;
          advanceReplayRef.current = null;
        }
      };

      // Store the advance function in ref (no longer used for scrape steps)
      advanceReplayRef.current = null;

      // Start the replay
      advanceToNextStep();

      return () => {
        // Clean up all timeouts
        timeouts.forEach((timeout) => clearTimeout(timeout));
        if (replayIntervalRef.current) {
          clearTimeout(replayIntervalRef.current);
          replayIntervalRef.current = null;
        }
        isReplayRunningRef.current = false;
      };
    }
  }, [replayMode, steps]);

  // In live mode, always follow the latest step unless view is locked
  useEffect(() => {
    if (!replayMode && steps.length > 0 && !isViewLockedRef.current) {
      // Filter out tool_call steps
      const validSteps = steps
        .map((s, i) => ({ step: s, index: i }))
        .filter(({ step }) => step.step_type !== "tool_call");
      const latestValidIndex =
        validSteps.length > 0
          ? validSteps[validSteps.length - 1].index
          : steps.length - 1;
      setCurrentStepIndex(latestValidIndex);
    }
  }, [replayMode, steps]);

  // Notify parent of current step changes
  useEffect(() => {
    if (onCurrentStepChange) {
      onCurrentStepChange(currentStepIndex);
    }
  }, [currentStepIndex, onCurrentStepChange]);

  // Get current step data
  const currentStep = steps[currentStepIndex];

  // Find the relevant search step for the current step being viewed
  // If current step is a search, use it. Otherwise, find the most recent non-failed search before current step
  const relevantSearchStep =
    currentStep?.step_type === "search" && currentStep?.status !== "failed"
      ? currentStep
      : steps
          .slice(0, currentStepIndex + 1)
          .reverse()
          .find((s) => s.step_type === "search" && s.status !== "failed");

  // Extract search results from the relevant search step
  const searchResults: SearchResult[] = useMemo(
    () =>
      (
        relevantSearchStep?.output_data as {
          searchResults?: SearchResult[];
          results?: SearchResult[];
        }
      )?.searchResults ||
      (
        relevantSearchStep?.output_data as {
          searchResults?: SearchResult[];
          results?: SearchResult[];
        }
      )?.results ||
      [],
    [relevantSearchStep],
  );
  const searchQuery =
    (relevantSearchStep?.input_data as { query?: string })?.query || "";

  // Check if we're currently searching
  const isSearching =
    currentStep?.step_type === "search" && currentStep?.status === "running";

  // Handle screenshot display (for live mode only - replay mode handles this in animation)
  useEffect(() => {
    // Skip this effect in replay mode - the animation handles it
    if (replayMode) return;

    // Check if we're scraping
    if (currentStep?.step_type === "scrape") {
      const scrapedUrl =
        (currentStep.output_data as { url?: string })?.url ||
        (currentStep.input_data as { url?: string })?.url;
      const resultIndex = searchResults.findIndex((r) => r.url === scrapedUrl);
      setActiveResultIndex(resultIndex);

      // Check if we have a screenshot
      if ((currentStep.output_data as { screenshot?: string })?.screenshot) {
        // We have a screenshot - show it immediately
        setIsScrapingWithoutScreenshot(false);
        setIsImageLoaded(false);
        setIsImageTall(false);
        setCurrentScreenshot(
          (currentStep.output_data as { screenshot: string }).screenshot,
        );
        setShowScreenshot(true);
      } else {
        // We're scraping but don't have a screenshot yet - show skeleton
        setIsScrapingWithoutScreenshot(true);
        setShowScreenshot(false);
        setCurrentScreenshot(null);
      }
    } else {
      // Not a scrape step
      setIsScrapingWithoutScreenshot(false);
      setShowScreenshot(false);
      setCurrentScreenshot(null);
      setActiveResultIndex(-1);
    }
  }, [currentStep, searchResults, replayMode]);

  // Lock view for 5 seconds when screenshot data arrives (live mode only)
  useEffect(() => {
    // Only apply view lock in live mode, not replay mode
    if (
      !replayMode &&
      showScreenshot &&
      currentStep?.step_type === "scrape" &&
      currentStep?.status !== "failed"
    ) {
      // Lock the view to prevent switching to new steps
      isViewLockedRef.current = true;

      // Clear any existing timer
      if (viewLockTimerRef.current) {
        clearTimeout(viewLockTimerRef.current);
      }

      // Unlock after 5 seconds
      viewLockTimerRef.current = setTimeout(() => {
        isViewLockedRef.current = false;
      }, 5000);

      return () => {
        if (viewLockTimerRef.current) {
          clearTimeout(viewLockTimerRef.current);
          viewLockTimerRef.current = null;
        }
      };
    }
  }, [
    showScreenshot,
    currentStep?.id,
    currentStep?.step_type,
    currentStep?.status,
    replayMode,
  ]);

  const getUrlBarContent = () => {
    if (!currentStep) {
      return {
        icon: <Globe className="h-4 w-4" />,
        text: "",
        action: "idle",
      };
    }

    // Prioritize showing scraping URL when actively scraping
    if (currentStep.step_type === "scrape") {
      const url =
        (currentStep.output_data as { url?: string })?.url ||
        (currentStep.input_data as { url?: string })?.url ||
        "";
      return {
        icon: <FileText className="h-4 w-4" />,
        text: url,
        action: "scraping",
      };
    }

    // Show search query when searching
    if (currentStep.step_type === "search") {
      // In replay mode with typing animation, show the typed query
      if (replayMode && isTypingQuery) {
        return {
          icon: <Search className="h-4 w-4" />,
          text: `Searching: ${typedQuery}`,
          action: "typing",
        };
      }

      return {
        icon: <Search className="h-4 w-4" />,
        text: `Searching: ${searchQuery}`,
        action: "searching",
      };
    }

    // Show generating summary when summarizing
    if (currentStep.step_type === "summarize") {
      return {
        icon: <Globe className="h-4 w-4" />,
        text: "Generating summary...",
        action: "summarizing",
      };
    }

    return {
      icon: <Globe className="h-4 w-4" />,
      text: "",
      action: "idle",
    };
  };

  const urlBar = getUrlBarContent();

  return (
    <div className="h-full flex flex-col bg-background-base relative">
      {/* Decorative corner connectors */}
      <Connector className="absolute -top-10 -left-[10.5px] z-10" />
      <Connector className="absolute -top-10 -right-[10.5px] z-10" />

      {/* Top border line */}
      <div className="h-1 w-full bg-border-faint shrink-0" />

      {/* Section header with step indicator */}
      <div className="px-16 sm:px-24 py-12 sm:py-16 border-b border-border-faint bg-white shrink-0">
        <div className="flex items-center gap-12 sm:gap-16">
          <div className="w-2 h-16 bg-heat-100 shrink-0" />
          <div className="flex items-center gap-8 sm:gap-12 text-mono-x-small font-mono text-black-alpha-32 min-w-0">
            {(urlBar.action === "searching" || urlBar.action === "typing") && (
              <>
                <Search className="w-14 h-14 shrink-0" />
                <span className="uppercase tracking-wider">Search</span>
              </>
            )}
            {urlBar.action === "scraping" && (
              <>
                <FileText className="w-14 h-14 shrink-0" />
                <span className="uppercase tracking-wider">Scraping</span>
              </>
            )}
            {urlBar.action === "summarizing" && (
              <>
                <Sparkles className="w-14 h-14 shrink-0" />
                <span className="uppercase tracking-wider">Summary</span>
              </>
            )}
            {urlBar.action === "idle" && (
              <>
                <Globe className="w-14 h-14 shrink-0" />
                <span className="uppercase tracking-wider">Ready</span>
              </>
            )}
          </div>

          {/* Status badge */}
          {(urlBar.action === "searching" ||
            urlBar.action === "typing" ||
            urlBar.action === "scraping" ||
            urlBar.action === "summarizing") && (
            <div className="ml-auto flex items-center gap-6 px-8 py-4 bg-heat-100/10 rounded-4 shrink-0">
              <div className="w-6 h-6 bg-heat-100 rounded-full animate-pulse" />
              <span className="text-mono-x-small font-mono text-heat-100 uppercase tracking-wider hidden sm:inline">
                {urlBar.action === "typing"
                  ? "Typing"
                  : urlBar.action === "searching"
                    ? "Searching"
                    : urlBar.action === "scraping"
                      ? "Scraping"
                      : "Generating"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content display */}
      <div className="flex-1 overflow-hidden relative bg-white">
        {isScrapingWithoutScreenshot ? (
          /* Skeleton website while scraping */
          <div className="absolute inset-0 bg-background-base overflow-hidden">
            {/* Simulated browser with skeleton */}
            <div className="h-full flex flex-col">
              {/* Browser chrome */}
              <div className="bg-white border-b border-border-faint px-12 py-8 flex items-center gap-8 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 rounded-full bg-heat-100/30 animate-pulse" />
                  <div className="w-10 h-10 rounded-full bg-heat-100/20 animate-pulse" />
                  <div className="w-10 h-10 rounded-full bg-heat-100/10 animate-pulse" />
                </div>
                <div className="flex-1 h-28 bg-black-alpha-4 rounded-6 animate-pulse" />
              </div>

              {/* Page skeleton */}
              <div className="flex-1 p-24 sm:p-32 space-y-24 overflow-hidden animate-pulse">
                {/* Header skeleton */}
                <div className="h-48 bg-black-alpha-8 rounded-6 w-2/3" />

                {/* Content lines */}
                <div className="space-y-12">
                  <div className="h-14 bg-black-alpha-6 rounded-4 w-full" />
                  <div className="h-14 bg-black-alpha-6 rounded-4 w-5/6" />
                  <div className="h-14 bg-black-alpha-6 rounded-4 w-4/5" />
                </div>

                {/* Image placeholder */}
                <div className="h-160 bg-black-alpha-4 rounded-8 border border-border-faint" />

                {/* More content */}
                <div className="space-y-12">
                  <div className="h-14 bg-black-alpha-6 rounded-4 w-full" />
                  <div className="h-14 bg-black-alpha-6 rounded-4 w-3/4" />
                </div>
              </div>
            </div>

            {/* Loading indicator overlay */}
            <div className="absolute bottom-16 sm:bottom-24 right-16 sm:right-24 bg-white border border-border-faint rounded-8 shadow-lg overflow-hidden animate-fade-up">
              <div className="flex items-center gap-12 px-16 py-12">
                <SymbolColored className="w-20 h-auto animate-pulse" />
                <div className="flex flex-col gap-2">
                  <span className="text-label-small font-medium text-accent-black">
                    Loading page
                  </span>
                  <span className="text-mono-x-small font-mono text-black-alpha-48">
                    Fetching content...
                  </span>
                </div>
              </div>
              <div className="h-2 bg-heat-100/20">
                <div
                  className="h-full bg-heat-100 animate-[loading_2s_ease-in-out_infinite]"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          </div>
        ) : showScreenshot && currentScreenshot ? (
          <div className="absolute inset-0 flex flex-col bg-background-base">
            {/* Browser chrome header */}
            <div className="bg-white border-b border-border-faint px-12 py-8 flex items-center gap-8 shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 rounded-full bg-heat-100" />
                <div className="w-10 h-10 rounded-full bg-heat-80" />
                <div className="w-10 h-10 rounded-full bg-heat-60" />
              </div>
              <div className="flex-1 flex items-center gap-8 bg-black-alpha-4 rounded-6 px-12 py-4">
                <Globe className="w-12 h-12 text-black-alpha-40" />
                <span className="text-mono-x-small font-mono text-black-alpha-56 truncate">
                  {urlBar.text}
                </span>
              </div>
              <ExternalLink className="w-14 h-14 text-black-alpha-32" />
            </div>

            {/* Screenshot content */}
            <div className="relative flex-1 bg-white overflow-hidden">
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={cn(
                    "screenshot-scroll-container w-full transition-opacity duration-300",
                    isImageTall && isImageLoaded && "animate-screenshot-scroll",
                    isImageLoaded ? "opacity-100" : "opacity-80",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={screenshotRef}
                    src={currentScreenshot}
                    alt="Screenshot"
                    className={cn(
                      "w-full",
                      isImageTall
                        ? "object-cover object-top"
                        : "object-contain h-full",
                    )}
                    style={{
                      maxHeight: isImageTall ? "4000px" : undefined,
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      const containerHeight =
                        img.parentElement?.parentElement?.clientHeight || 0;

                      // Limit image height to 4000px
                      const maxHeight = 4000;
                      const actualImageHeight = Math.min(
                        img.naturalHeight,
                        maxHeight,
                      );
                      const imageHeight =
                        actualImageHeight *
                        (img.clientWidth / img.naturalWidth);

                      setIsImageTall(imageHeight > containerHeight * 1.5);

                      setTimeout(() => {
                        setIsImageLoaded(true);
                      }, 100);
                    }}
                  />
                </div>
                {/* Fade gradients for smooth scrolling effect */}
                {isImageTall && isImageLoaded && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  </>
                )}
              </div>

              {/* Scanner effect overlay */}
              <div className="absolute inset-0 pointer-events-none animate-fade-in">
                <div className="scanner-line" />
                {/* Grid overlay effect */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 40px,
                    rgba(250, 93, 25, 0.03) 40px,
                    rgba(250, 93, 25, 0.03) 41px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 40px,
                    rgba(250, 93, 25, 0.03) 40px,
                    rgba(250, 93, 25, 0.03) 41px
                  )`,
                  }}
                />
              </div>

              {/* Scanning badge */}
              <div className="absolute bottom-16 sm:bottom-24 right-16 sm:right-24 bg-white border border-border-faint rounded-8 shadow-lg overflow-hidden animate-fade-up">
                <div className="flex items-center gap-12 px-16 py-12">
                  <SymbolColored className="w-20 h-auto" />
                  <div className="flex flex-col gap-2">
                    <span className="text-label-small font-medium text-accent-black">
                      Scanning content
                    </span>
                    <span className="text-mono-x-small font-mono text-black-alpha-48">
                      Extracting data...
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-heat-100/20">
                  <div
                    className="h-full bg-heat-100 animate-[loading_1.5s_ease-in-out_infinite]"
                    style={{ width: "80%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : currentStep?.step_type === "summarize" ? (
          /* Summary display */
          <div className="h-full flex flex-col overflow-hidden bg-background-base">
            {/* Summary content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-16 sm:p-24">
                {/* Summary card */}
                <div className="relative bg-white rounded-12 border border-border-faint overflow-hidden">
                  <CurvyRect
                    className="absolute h-[calc(100%+1px)] left-0 w-full opacity-50"
                    allSides
                  />

                  <div className="relative p-20 sm:p-32">
                    {isTypingSummary ? (
                      <div className="text-black-alpha-72">
                        <MarkdownRenderer content={typedSummary} />
                        <span className="inline-block w-2 h-20 bg-heat-100 ml-4 animate-pulse" />
                      </div>
                    ) : (
                      <MarkdownRenderer
                        content={
                          (currentStep.output_data as { response?: string })
                            ?.response || "No summary available"
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden bg-background-base">
            {/* Search box header */}
            {(searchQuery || typedQuery) && (
              <div className="bg-white border-b border-border-faint px-16 sm:px-24 py-12 sm:py-16 shrink-0">
                <div className="flex items-center gap-12 sm:gap-16">
                  {/* Firecrawl logo */}
                  <SymbolColored className="w-24 h-auto shrink-0" />

                  {/* Search input display */}
                  <div className="flex-1 flex items-center gap-8 bg-black-alpha-4 rounded-8 px-12 sm:px-16 py-8 sm:py-10 min-w-0">
                    <Search className="w-16 h-16 text-black-alpha-40 shrink-0" />
                    <span className="text-body-small text-accent-black truncate flex-1">
                      {isTypingQuery ? typedQuery : searchQuery || "Search..."}
                      {isTypingQuery && (
                        <span className="inline-block w-2 h-16 bg-heat-100 ml-2 animate-pulse" />
                      )}
                    </span>
                  </div>

                  {/* Results count badge */}
                  {searchResults.length > 0 &&
                    !isTypingQuery &&
                    !isShowingSkeleton && (
                      <div className="hidden sm:flex items-center gap-6 px-8 py-4 bg-black-alpha-4 rounded-4 shrink-0">
                        <span className="text-mono-x-small font-mono text-black-alpha-56">
                          {searchResults.length} results
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Search results */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-16 sm:p-24">
                {/* Results list */}
                <div className="space-y-16">
                  {/* Show skeleton during typing or skeleton phase in replay mode */}
                  {isTypingQuery || isShowingSkeleton ? (
                    <div className="space-y-16">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="bg-white rounded-8 border border-border-faint p-16 space-y-12"
                        >
                          <div className="flex items-center gap-8">
                            <Skeleton className="w-16 h-16 rounded-4" />
                            <Skeleton className="h-12 w-1/3" />
                          </div>
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-4/5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {searchResults.map((result, index) => {
                        const hostname = new URL(result.url).hostname;
                        const urlPath = result.url
                          .split("/")
                          .slice(3)
                          .filter(Boolean)
                          .join(" › ");

                        return (
                          <div
                            key={index}
                            className={cn(
                              "relative bg-white rounded-8 border p-16 transition-all",
                              activeResultIndex === index
                                ? "border-heat-100 shadow-lg ring-2 ring-heat-100/20"
                                : "border-border-faint hover:border-black-alpha-16 hover:shadow-sm",
                            )}
                          >
                            {/* Active indicator bar */}
                            {activeResultIndex === index && (
                              <div className="absolute left-0 top-0 bottom-0 w-3 bg-heat-100 rounded-l-8" />
                            )}

                            {/* Site info with favicon */}
                            <div className="flex items-center gap-8 mb-8">
                              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                                <Favicon
                                  src={result.favicon}
                                  url={result.url}
                                />
                              </div>
                              <div className="text-mono-x-small font-mono text-black-alpha-48 truncate">
                                {hostname}
                                {urlPath && (
                                  <span className="hidden sm:inline">
                                    {" "}
                                    ›{" "}
                                    {urlPath.length > 30
                                      ? urlPath.substring(0, 30) + "..."
                                      : urlPath}
                                  </span>
                                )}
                              </div>
                              {activeResultIndex === index && (
                                <div className="ml-auto flex items-center gap-4 px-6 py-2 bg-heat-100/10 rounded-4 shrink-0">
                                  <div className="w-6 h-6 bg-heat-100 rounded-full animate-pulse" />
                                  <span className="text-mono-x-small font-mono text-heat-100">
                                    Analyzing
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="mb-6">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-body-large font-medium text-accent-black hover:text-heat-100 transition-colors line-clamp-2"
                              >
                                {result.title}
                              </a>
                            </h3>

                            {/* Description */}
                            <div className="text-body-small text-black-alpha-56 leading-relaxed line-clamp-2">
                              {result.publishedTime && (
                                <span className="text-black-alpha-40">
                                  {result.publishedTime} —{" "}
                                </span>
                              )}
                              {result.description || "No description available"}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {searchResults.length === 0 &&
                    searchQuery &&
                    !isTypingQuery &&
                    !isShowingSkeleton &&
                    !isSearching && (
                      <div className="bg-white rounded-8 border border-border-faint p-32 text-center">
                        <SymbolColored className="w-32 h-auto mx-auto mb-16 opacity-30" />
                        <p className="text-body-large text-black-alpha-72 mb-8">
                          No results found
                        </p>
                        <p className="text-body-small text-black-alpha-48">
                          Your search for &quot;
                          <span className="font-medium text-accent-black">
                            {searchQuery}
                          </span>
                          &quot; did not match any documents.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom border and connectors */}
      <div className="h-1 w-full bg-border-faint shrink-0" />
      <Connector className="absolute -bottom-10 -left-[10.5px] z-10" />
      <Connector className="absolute -bottom-10 -right-[10.5px] z-10" />
    </div>
  );
}
