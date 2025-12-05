/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Globe,
  FileText,
  Lightbulb,
  Eye,
  type LucideIcon,
} from "lucide-react";
import Button from "@/components/ui/shadcn/button";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import { Connector } from "@/components/shared/layout/curvy-rect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/shadcn/accordion";
import { ScoutVisualDisplay } from "@/components/scout-visual-display";

// Simple markdown renderer component
function MarkdownRenderer({ content }: { content: string }) {
  // Convert markdown to JSX with basic formatting
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
      return (
        text
          // Links: [text](url)
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-heat-100 hover:underline">$1</a>',
          )
          // Bold: **text** or __text__
          .replace(
            /\*\*([^*]+)\*\*/g,
            '<strong class="text-accent-black">$1</strong>',
          )
          .replace(
            /__([^_]+)__/g,
            '<strong class="text-accent-black">$1</strong>',
          )
          // Italic: *text* or _text_
          .replace(/\*([^*]+)\*/g, "<em>$1</em>")
          .replace(/_([^_]+)_/g, "<em>$1</em>")
          // Code: `code`
          .replace(
            /`([^`]+)`/g,
            '<code class="bg-black-alpha-4 px-6 py-2 rounded-4 text-mono-small font-mono">$1</code>',
          )
      );
    };

    lines.forEach((line, index) => {
      // Headers
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
      }
      // Unordered list
      else if (line.match(/^[\-\*]\s+/)) {
        if (listType !== "ul") {
          flushList(index);
          listType = "ul";
        }
        currentList.push(line.replace(/^[\-\*]\s+/, ""));
      }
      // Ordered list
      else if (line.match(/^\d+\.\s+/)) {
        if (listType !== "ol") {
          flushList(index);
          listType = "ol";
        }
        currentList.push(line.replace(/^\d+\.\s+/, ""));
      }
      // Empty line
      else if (line.trim() === "") {
        flushList(index);
        if (
          elements.length > 0 &&
          elements[elements.length - 1]?.type !== "br"
        ) {
          elements.push(<br key={index} />);
        }
      }
      // Regular paragraph
      else {
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

type ExecutionStep = {
  id: string;
  execution_id: string;
  step_number: number;
  step_type: "search" | "scrape" | "analyze" | "summarize" | "tool_call";
  description: string;
  input_data: unknown;
  output_data: unknown;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

// Helper to detect if a step is stuck (running for more than 5 minutes)
function isStepStuck(step: ExecutionStep): boolean {
  if (step.status !== "running") return false;
  const startedAt = new Date(step.started_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return now - startedAt > fiveMinutes;
}

// Get effective status (treats stuck steps as failed)
function getEffectiveStatus(
  step: ExecutionStep,
): "running" | "completed" | "failed" {
  return isStepStuck(step) ? "failed" : step.status;
}

type ScoutResultsSummary = {
  taskCompleted?: boolean;
  taskStatus?: string;
  response?: string;
  message?: string;
};

type Execution = {
  id: string;
  scout_id: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  results_summary: ScoutResultsSummary | string | null;
  summary_text: string | null;
};

type Scout = {
  id: string;
  frequency: "daily" | "every_3_days" | "weekly" | null;
  last_run_at: string | null;
  is_active: boolean;
};

type ScoutExecutionPanelProps = {
  scoutId: string;
  showNotFound: boolean;
  refreshTrigger?: number;
};

const stepIcons: Record<ExecutionStep["step_type"], LucideIcon> = {
  search: Search,
  scrape: Globe,
  analyze: Lightbulb,
  summarize: FileText,
  tool_call: Loader2,
};

export function ScoutExecutionPanel({
  scoutId,
  showNotFound,
  refreshTrigger,
}: ScoutExecutionPanelProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [executionSteps, setExecutionSteps] = useState<
    Record<string, ExecutionStep[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [selectedExecutionForJson, setSelectedExecutionForJson] = useState<
    string | null
  >(null);
  const [currentVisualStepIndex, setCurrentVisualStepIndex] = useState(0);
  const [scout, setScout] = useState<Scout | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>("");
  const [hasClickedInspect, setHasClickedInspect] = useState(false);

  // Load executions for this scout
  const loadExecutions = useCallback(async () => {
    const { data } = await supabase
      .from("scout_executions")
      .select("*")
      .eq("scout_id", scoutId)
      .order("started_at", { ascending: false })
      .limit(10);

    if (data) {
      setExecutions(data);
    }
    setLoading(false);
  }, [scoutId]);

  // Load steps for a specific execution
  const loadSteps = useCallback(
    async (executionId: string) => {
      // Check if we already have steps for this execution
      if (executionSteps[executionId]) {
        return;
      }

      const { data } = await supabase
        .from("scout_execution_steps")
        .select("*")
        .eq("execution_id", executionId)
        .order("step_number", { ascending: true });

      if (data) {
        setExecutionSteps((prev) => ({
          ...prev,
          [executionId]: data,
        }));
      }
    },
    [executionSteps],
  );

  // Load scout data
  const loadScout = useCallback(async () => {
    const { data } = await supabase
      .from("scouts")
      .select("id, frequency, last_run_at, is_active")
      .eq("id", scoutId)
      .single();

    if (data) {
      setScout(data);
    }
  }, [scoutId]);

  // Initial data load on mount and when refreshTrigger changes
  useEffect(() => {
    setLoading(true);
    setExecutionSteps({}); // Clear cached steps when refreshing
    loadExecutions();
    loadScout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Update countdown every second
  useEffect(() => {
    if (!scout) return;

    // Calculate immediately
    const calculate = () => {
      if (!scout.is_active || !scout.frequency || !scout.last_run_at) {
        setTimeUntilNext("");
        return;
      }

      const lastRun = new Date(scout.last_run_at);
      const now = new Date();

      let nextRun: Date;
      switch (scout.frequency) {
        case "daily":
          nextRun = new Date(lastRun.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "every_3_days":
          nextRun = new Date(lastRun.getTime() + 3 * 24 * 60 * 60 * 1000);
          break;
        case "weekly":
          nextRun = new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          setTimeUntilNext("");
          return;
      }

      const diffMs = nextRun.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeUntilNext("Running soon...");
        return;
      }

      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        const remainingHours = hours % 24;
        if (remainingHours > 0) {
          setTimeUntilNext(
            `${days} day${days > 1 ? "s" : ""} and ${remainingHours} hour${remainingHours > 1 ? "s" : ""}`,
          );
        } else {
          setTimeUntilNext(`${days} day${days > 1 ? "s" : ""}`);
        }
      } else if (hours > 0) {
        const remainingMinutes = minutes % 60;
        if (remainingMinutes > 0) {
          setTimeUntilNext(
            `${hours} hour${hours > 1 ? "s" : ""} and ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`,
          );
        } else {
          setTimeUntilNext(`${hours} hour${hours > 1 ? "s" : ""}`);
        }
      } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        if (remainingSeconds > 0) {
          setTimeUntilNext(
            `${minutes} minute${minutes > 1 ? "s" : ""} and ${remainingSeconds} second${remainingSeconds > 1 ? "s" : ""}`,
          );
        } else {
          setTimeUntilNext(`${minutes} minute${minutes > 1 ? "s" : ""}`);
        }
      } else {
        setTimeUntilNext(`${seconds} second${seconds > 1 ? "s" : ""}`);
      }
    };

    calculate(); // Calculate immediately
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [scout]);

  // Set up real-time subscriptions
  useEffect(() => {
    // Subscribe to execution changes
    const executionSubscription = supabase
      .channel(`executions-${scoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scout_executions",
          filter: `scout_id=eq.${scoutId}`,
        },
        () => {
          loadExecutions();
          loadScout(); // Reload scout to get updated last_run_at
        },
      )
      .subscribe();

    // Subscribe to scout changes (for frequency/active status changes)
    const scoutSubscription = supabase
      .channel(`scout-${scoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scouts",
          filter: `id=eq.${scoutId}`,
        },
        () => {
          loadScout();
        },
      )
      .subscribe();

    // Subscribe to step changes for this scout's executions
    const stepSubscription = supabase
      .channel(`steps-${scoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scout_execution_steps",
        },
        async (payload) => {
          // Reload steps for the affected execution
          if (payload.new && "execution_id" in payload.new) {
            const executionId = payload.new.execution_id as string;
            // Fetch and update directly without clearing cache first
            const { data } = await supabase
              .from("scout_execution_steps")
              .select("*")
              .eq("execution_id", executionId)
              .order("step_number", { ascending: true });

            if (data) {
              setExecutionSteps((prev) => ({
                ...prev,
                [executionId]: data,
              }));
            }
          }
        },
      )
      .subscribe();

    return () => {
      executionSubscription.unsubscribe();
      scoutSubscription.unsubscribe();
      stepSubscription.unsubscribe();
    };
  }, [scoutId, loadExecutions, loadScout, loadSteps]);

  // Auto-refresh for running executions in modal
  useEffect(() => {
    if (!selectedExecutionForJson) return;

    const execution = executions.find((e) => e.id === selectedExecutionForJson);
    if (!execution || execution.status !== "running") return;

    const interval = setInterval(async () => {
      // Reload steps without clearing cache first (to avoid flicker)
      const { data } = await supabase
        .from("scout_execution_steps")
        .select("*")
        .eq("execution_id", selectedExecutionForJson)
        .order("step_number", { ascending: true });

      if (data) {
        setExecutionSteps((prev) => ({
          ...prev,
          [selectedExecutionForJson]: data,
        }));
      }

      // Reload executions to get latest results_summary
      loadExecutions();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [selectedExecutionForJson, executions, loadExecutions]);

  if (loading) {
    return (
      <div className="max-w-800 mx-auto">
        <div className="space-y-32">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-16">
              <div className="flex items-center gap-16">
                <Skeleton className="h-16 w-200 rounded-4" />
                <div className="flex-1 h-1 bg-border-faint" />
                <Skeleton className="h-32 w-80 rounded-6" />
              </div>
              <Skeleton className="h-24 w-3/4 rounded-4" />
              <Skeleton className="h-16 w-full rounded-4" />
              <Skeleton className="h-16 w-5/6 rounded-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-80">
        <div className="text-center">
          <div className="w-48 h-48 rounded-full bg-black-alpha-4 flex items-center justify-center mx-auto mb-24">
            <Eye className="w-24 h-24 text-black-alpha-32" />
          </div>
          <p className="text-body-large font-medium text-accent-black mb-8">
            No executions yet
          </p>
          <p className="text-body-medium text-black-alpha-56 max-w-320">
            Click &quot;Run Now&quot; to execute this scout manually, or wait
            for it to run automatically based on its schedule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-800 mx-auto">
        {executions.map((execution, executionIndex) => {
          // Parse JSON from results_summary
          let parsed: ScoutResultsSummary | null = null;
          let isNotFound = false;

          if (execution.results_summary) {
            // Check if results_summary is already an object
            if (
              typeof execution.results_summary === "object" &&
              execution.results_summary !== null
            ) {
              parsed = execution.results_summary as ScoutResultsSummary;
              isNotFound = parsed.taskCompleted === false;
            } else if (typeof execution.results_summary === "string") {
              // It's a string - try to parse it as JSON
              try {
                let jsonString = execution.results_summary.trim();

                // Remove common prefixes
                jsonString = jsonString.replace(/^Summary:\s*/i, "");

                // Remove markdown code fences
                if (jsonString.includes("```json")) {
                  jsonString = jsonString
                    .replace(/```json\s*/g, "")
                    .replace(/```\s*/g, "");
                } else if (jsonString.includes("```")) {
                  jsonString = jsonString.replace(/```\s*/g, "");
                }

                // Find first valid JSON object
                const firstBrace = jsonString.indexOf("{");
                if (firstBrace !== -1) {
                  jsonString = jsonString.substring(firstBrace);

                  // Find matching closing brace
                  let braceCount = 0;
                  let endIndex = -1;
                  for (let i = 0; i < jsonString.length; i++) {
                    if (jsonString[i] === "{") braceCount++;
                    if (jsonString[i] === "}") braceCount--;
                    if (braceCount === 0) {
                      endIndex = i + 1;
                      break;
                    }
                  }
                  if (endIndex !== -1) {
                    jsonString = jsonString.substring(0, endIndex);
                  }
                }

                // Parse the JSON
                parsed = JSON.parse(jsonString) as ScoutResultsSummary;
                isNotFound = parsed.taskCompleted === false;
              } catch {
                // JSON parsing failed - show as raw text
                parsed = null;
                isNotFound = false;
              }
            }
          }

          // Filter: only hide executions where taskCompleted is explicitly false
          if (isNotFound && !showNotFound) {
            return null;
          }

          return (
            <div key={execution.id} className="py-24 first:pt-0 px-10">
              {/* Date/Time Header with Line */}
              <div className="flex items-center gap-12 sm:gap-16 mb-20">
                <div className="flex items-center gap-8 text-mono-x-small font-mono text-black-alpha-48 whitespace-nowrap">
                  {execution.status === "running" && (
                    <Loader2 className="animate-spin text-heat-100 w-14 h-14" />
                  )}
                  {execution.status === "completed" && (
                    <CheckCircle2
                      className={`w-14 h-14 ${isNotFound ? "text-red-500" : "text-green-500"}`}
                    />
                  )}
                  {execution.status === "failed" && (
                    <XCircle className="text-red-500 w-14 h-14" />
                  )}
                  <span className="uppercase tracking-wider">
                    {new Date(execution.started_at).toLocaleDateString()} ·{" "}
                    {new Date(execution.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex-1 h-1 min-w-16 bg-primary" />
                <Button
                  variant="primary"
                  onClick={() => {
                    loadSteps(execution.id);
                    setSelectedExecutionForJson(execution.id);
                    setCurrentVisualStepIndex(0);
                    setHasClickedInspect(true);
                  }}
                  className={
                    executionIndex === 0 &&
                    executions.length === 1 &&
                    execution.status === "running" &&
                    !hasClickedInspect
                      ? "animate-bounce"
                      : ""
                  }
                >
                  <Eye className="w-14 h-14" />
                  <span className="hidden xs:inline sm:inline">Inspect</span>
                </Button>
              </div>

              {/* One-sentence summary (if available) */}
              {execution.summary_text && execution.status === "completed" && (
                <div className="mb-20 p-16 bg-heat-100/5 border-l-2 border-heat-100 rounded-r-6">
                  <p className="text-body-medium font-medium text-accent-black leading-relaxed">
                    {execution.summary_text}
                  </p>
                </div>
              )}

              {/* Agent Response */}
              <div className="mb-24">
                {(() => {
                  if (execution.status === "running") {
                    // Check if this is the first execution
                    const isFirstExecution =
                      executionIndex === 0 && executions.length === 1;

                    if (isFirstExecution) {
                      return (
                        <div className="border border-border-faint rounded-8 p-24 bg-black-alpha-2">
                          <div className="mb-20">
                            <h3 className="text-body-large font-semibold text-accent-black mb-8">
                              Your scout is running its first job
                            </h3>
                            <p className="text-body-medium text-black-alpha-56">
                              Searching and analyzing results in real-time
                            </p>
                          </div>

                          <div className="space-y-16">
                            <div className="flex items-start gap-12">
                              <Eye className="text-heat-100 shrink-0 mt-2 w-16 h-16" />
                              <p className="text-body-medium text-black-alpha-72">
                                Click the{" "}
                                <span className="font-semibold text-accent-black">
                                  Inspect
                                </span>{" "}
                                button above to watch the work being done in
                                real-time
                              </p>
                            </div>
                            <div className="flex items-start gap-12">
                              <CheckCircle2 className="text-heat-100 shrink-0 mt-2 w-16 h-16" />
                              <p className="text-body-medium text-black-alpha-72">
                                When complete, results will appear here and
                                you&apos;ll receive an alert via your preferred
                                notification method
                              </p>
                            </div>
                          </div>

                          <div className="mt-20">
                            <a
                              href="/settings"
                              className="text-body-small text-heat-100 hover:text-heat-90 font-medium inline-flex items-center gap-6 transition-colors"
                            >
                              Configure notifications
                              <span>→</span>
                            </a>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="text-black-alpha-48 italic">
                        Execution in progress...
                      </div>
                    );
                  }

                  // Try to get the markdown content
                  const markdownContent = parsed?.response || parsed?.message;

                  if (markdownContent) {
                    return (
                      <div className="prose prose-sm max-w-none px-12 bg-heat-100/5 border-l-2 border-gray-300 rounded-r-6 sm:pl-30">
                        <MarkdownRenderer content={markdownContent} />
                      </div>
                    );
                  }

                  // Fallback: try to extract response from results_summary
                  if (execution.results_summary) {
                    // If it's an object, try to get the response field directly
                    if (
                      typeof execution.results_summary === "object" &&
                      execution.results_summary !== null
                    ) {
                      const summary =
                        execution.results_summary as ScoutResultsSummary;
                      const responseContent =
                        summary.response || summary.message;
                      if (responseContent) {
                        return (
                          <div className="prose prose-sm max-w-none px-12">
                            <MarkdownRenderer content={responseContent} />
                          </div>
                        );
                      }
                    }

                    // Last resort: show as raw text (for string summaries without JSON)
                    const displayText =
                      typeof execution.results_summary === "string"
                        ? execution.results_summary
                        : JSON.stringify(execution.results_summary, null, 2);

                    return (
                      <div className="text-body-medium text-black-alpha-72 leading-relaxed whitespace-pre-wrap">
                        {displayText}
                      </div>
                    );
                  }

                  return (
                    <div className="text-black-alpha-48 italic">
                      No results available
                    </div>
                  );
                })()}

                {execution.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded-6 p-16 mt-20">
                    <p className="font-medium text-red-900 mb-4">Error</p>
                    <p className="text-red-700 text-body-small">
                      {execution.error_message}
                    </p>
                  </div>
                )}

                {/* Execution metadata */}
                <div className="mt-20 text-mono-x-small font-mono text-black-alpha-32 flex items-center gap-12">
                  {execution.completed_at && (
                    <span>
                      Completed in{" "}
                      {(
                        (new Date(execution.completed_at).getTime() -
                          new Date(execution.started_at).getTime()) /
                        1000
                      ).toFixed(0)}
                      s
                      {executionSteps[execution.id] &&
                        (() => {
                          const stepCount = executionSteps[execution.id].filter(
                            (s) => s.step_type !== "tool_call",
                          ).length;
                          return stepCount > 0
                            ? ` · ${stepCount} ${stepCount === 1 ? "step" : "steps"}`
                            : "";
                        })()}
                    </span>
                  )}
                  {!execution.completed_at &&
                    execution.status !== "running" && <span>Stopped</span>}
                </div>
              </div>

              {/* Separator line between executions */}
              {executionIndex < executions.length - 1 && (
                <div className="border-t border-border-faint" />
              )}
            </div>
          );
        })}
      </div>

      {/* JSON Modal with Visual Display */}
      <Dialog
        open={selectedExecutionForJson !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedExecutionForJson(null);
            setCurrentVisualStepIndex(0);
          }
        }}
      >
        <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[90vh] overflow-hidden flex flex-col bg-background-base p-16 sm:p-24">
          <DialogHeader className="mb-16 sm:mb-20">
            <DialogTitle className="text-body-large sm:text-title-h5 text-accent-black">
              Live Execution
            </DialogTitle>
            <DialogDescription className="text-mono-x-small sm:text-body-small text-black-alpha-48">
              Watch the execution in real-time
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-16 md:gap-24 relative">
            {selectedExecutionForJson &&
              (() => {
                const execution = executions.find(
                  (e) => e.id === selectedExecutionForJson,
                );
                const steps = executionSteps[selectedExecutionForJson] || [];

                if (!execution) return null;

                const isCompleted =
                  execution.status === "completed" ||
                  execution.status === "failed";

                return (
                  <>
                    {/* Left side: JSON Panel - Hidden on mobile */}
                    <div className="hidden md:flex md:w-[30%] flex-col overflow-hidden bg-white rounded-8 border border-border-faint relative">
                      {/* Decorative connectors */}
                      <Connector className="absolute -top-10 -left-[10.5px] z-10" />
                      <Connector className="absolute -top-10 -right-[10.5px] z-10" />

                      {/* Steps Section Header */}
                      <div className="px-16 py-12 border-b border-border-faint bg-background-base shrink-0">
                        <div className="flex items-center gap-12">
                          <div className="w-2 h-16 bg-heat-100 shrink-0" />
                          <div className="flex items-center gap-8 text-mono-x-small font-mono text-black-alpha-32">
                            <Eye className="w-14 h-14" />
                            <span className="uppercase tracking-wider">
                              Execution Steps
                            </span>
                            {steps.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-heat-100">
                                  {
                                    steps.filter(
                                      (s) => s.step_type !== "tool_call",
                                    ).length
                                  }
                                </span>
                              </>
                            )}
                          </div>
                          {execution.status === "running" && (
                            <div className="ml-auto flex items-center gap-4 px-6 py-2 bg-heat-100/10 rounded-4">
                              <div className="w-6 h-6 bg-heat-100 rounded-full animate-pulse" />
                              <span className="text-mono-x-small font-mono text-heat-100 uppercase">
                                Live
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scrollable content */}
                      <div className="flex-1 overflow-y-auto p-16 space-y-12">
                        {/* Steps */}
                        {steps.length > 0 ? (
                          <Accordion
                            type="multiple"
                            className="w-full min-w-0 space-y-8"
                          >
                            {steps
                              .filter((step) => step.step_type !== "tool_call")
                              .map((step) => {
                                const Icon = stepIcons[step.step_type];
                                const actualIndex = steps.findIndex(
                                  (s) => s.id === step.id,
                                );
                                const isActiveStep =
                                  actualIndex === currentVisualStepIndex;
                                const effectiveStatus =
                                  getEffectiveStatus(step);
                                const stuck = isStepStuck(step);

                                return (
                                  <AccordionItem
                                    key={step.id}
                                    value={`step-${step.id}`}
                                    className={`rounded-8 overflow-hidden transition-all ${
                                      isActiveStep
                                        ? "bg-heat-100/5 ring-2 ring-heat-100/20"
                                        : "bg-background-base hover:bg-black-alpha-4"
                                    }`}
                                  >
                                    <AccordionTrigger className="px-12 py-10 hover:no-underline w-full">
                                      <div className="flex items-center gap-10 w-full min-w-0">
                                        {/* Step indicator */}
                                        <div
                                          className={`w-32 h-32 rounded-8 flex items-center justify-center shrink-0 ${
                                            isActiveStep
                                              ? "bg-heat-100"
                                              : "bg-black-alpha-8"
                                          }`}
                                        >
                                          {effectiveStatus === "running" ? (
                                            <Loader2
                                              className={`animate-spin w-16 h-16 ${isActiveStep ? "text-white" : "text-heat-100"}`}
                                            />
                                          ) : effectiveStatus ===
                                            "completed" ? (
                                            <Icon
                                              className={`w-16 h-16 ${isActiveStep ? "text-white" : "text-heat-100"}`}
                                            />
                                          ) : (
                                            <XCircle
                                              className={`w-16 h-16 ${isActiveStep ? "text-white" : "text-red-500"}`}
                                            />
                                          )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0 overflow-hidden">
                                          <div className="flex items-center gap-6">
                                            <span className="text-label-small font-semibold text-accent-black capitalize">
                                              {step.step_type}
                                            </span>
                                            {effectiveStatus === "running" && (
                                              <span className="text-mono-x-small text-heat-100">
                                                Running
                                              </span>
                                            )}
                                            {effectiveStatus ===
                                              "completed" && (
                                              <CheckCircle2 className="w-12 h-12 text-green-500" />
                                            )}
                                          </div>
                                          <div className="text-mono-x-small text-black-alpha-48 font-normal truncate mt-2">
                                            {stuck
                                              ? "Step timed out"
                                              : step.description}
                                          </div>
                                        </div>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-12 pb-12 max-h-320 overflow-y-auto">
                                      {stuck && (
                                        <div className="bg-heat-100/10 border-l-2 border-heat-100 rounded-4 px-12 py-8 mb-12 text-mono-x-small text-heat-100">
                                          This step appears to be stuck (running
                                          for &gt; 5 minutes)
                                        </div>
                                      )}
                                      <pre className="text-mono-x-small bg-accent-black p-12 rounded-6 overflow-x-hidden whitespace-pre-wrap break-words font-mono text-white/80">
                                        {JSON.stringify(
                                          {
                                            id: step.id,
                                            step_type: step.step_type,
                                            status: step.status,
                                            started_at: step.started_at,
                                            completed_at: step.completed_at,
                                            input_data: step.input_data,
                                            output_data: step.output_data,
                                            error_message: step.error_message,
                                          },
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                          </Accordion>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-32 text-center">
                            <SymbolColored className="w-24 h-auto mb-12 opacity-30" />
                            <p className="text-body-small text-black-alpha-48">
                              Waiting for steps...
                            </p>
                          </div>
                        )}

                        {/* Divider */}
                        <div className="h-1 bg-border-faint my-16" />

                        {/* Execution Summary */}
                        <div>
                          <div className="flex items-center gap-8 mb-12">
                            <FileText className="w-14 h-14 text-black-alpha-32" />
                            <span className="text-mono-x-small font-mono text-black-alpha-32 uppercase tracking-wider">
                              Summary
                            </span>
                          </div>
                          <Accordion type="multiple" className="w-full min-w-0">
                            <AccordionItem
                              value="summary"
                              className="rounded-8 overflow-hidden bg-background-base hover:bg-black-alpha-4 transition-all"
                            >
                              <AccordionTrigger className="px-12 py-10 hover:no-underline w-full">
                                <div className="flex items-center gap-10 w-full min-w-0 overflow-hidden">
                                  <div className="w-32 h-32 rounded-8 bg-black-alpha-8 flex items-center justify-center shrink-0">
                                    <FileText className="text-heat-100 w-16 h-16" />
                                  </div>
                                  <span className="text-label-small font-semibold text-accent-black">
                                    Execution JSON
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-12 pb-12 max-h-320 overflow-y-auto">
                                <pre className="text-mono-x-small bg-accent-black p-12 rounded-6 overflow-x-hidden whitespace-pre-wrap break-words font-mono text-white/80">
                                  {JSON.stringify(
                                    {
                                      id: execution.id,
                                      status: execution.status,
                                      started_at: execution.started_at,
                                      completed_at: execution.completed_at,
                                      results_summary:
                                        execution.results_summary,
                                      error_message: execution.error_message,
                                    },
                                    null,
                                    2,
                                  )}
                                </pre>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </div>

                      {/* Bottom decorative connectors */}
                      <Connector className="absolute -bottom-10 -left-[10.5px] z-10" />
                      <Connector className="absolute -bottom-10 -right-[10.5px] z-10" />
                    </div>

                    {/* Right side: Visual Display - Full width on mobile */}
                    <div className="w-full md:w-[70%] overflow-hidden flex-1">
                      <ScoutVisualDisplay
                        steps={steps}
                        isActive={execution.status === "running"}
                        replayMode={isCompleted}
                        onCurrentStepChange={setCurrentVisualStepIndex}
                      />
                    </div>
                  </>
                );
              })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
