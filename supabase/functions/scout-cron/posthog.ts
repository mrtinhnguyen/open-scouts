// PostHog server-side analytics for edge functions

const POSTHOG_API_KEY = Deno.env.get("NEXT_PUBLIC_POSTHOG_KEY");
const POSTHOG_HOST = "https://us.i.posthog.com";

interface PostHogEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, any>;
}

/**
 * Capture an event to PostHog from the edge function.
 * This is a fire-and-forget operation - errors are logged but don't throw.
 */
export async function captureEvent({
  event,
  distinctId,
  properties = {},
}: PostHogEvent): Promise<void> {
  if (!POSTHOG_API_KEY) {
    console.warn("[PostHog] API key not configured, skipping event:", event);
    return;
  }

  try {
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "posthog-edge-function",
          source: "scout-cron",
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`[PostHog] Failed to capture event: ${response.status}`);
    }
  } catch (error: any) {
    console.error(`[PostHog] Error capturing event:`, error.message);
  }
}

/**
 * Track scout execution started
 */
export async function trackExecutionStarted(
  userId: string,
  scoutId: string,
  executionId: string,
  scoutTitle: string,
  triggerSource: "automatic" | "manual"
): Promise<void> {
  await captureEvent({
    event: "scout_execution_started",
    distinctId: userId,
    properties: {
      scout_id: scoutId,
      execution_id: executionId,
      scout_title: scoutTitle,
      trigger_source: triggerSource,
    },
  });
}

/**
 * Track scout execution completed successfully
 */
export async function trackExecutionCompleted(
  userId: string,
  scoutId: string,
  executionId: string,
  scoutTitle: string,
  params: {
    duration_ms: number;
    steps_count: number;
    results_found: boolean;
    is_duplicate: boolean;
    api_calls_count: number;
  }
): Promise<void> {
  await captureEvent({
    event: "scout_execution_completed",
    distinctId: userId,
    properties: {
      scout_id: scoutId,
      execution_id: executionId,
      scout_title: scoutTitle,
      ...params,
    },
  });
}

/**
 * Track scout execution failed
 */
export async function trackExecutionFailed(
  userId: string,
  scoutId: string,
  executionId: string,
  scoutTitle: string,
  errorMessage: string,
  duration_ms: number
): Promise<void> {
  await captureEvent({
    event: "scout_execution_failed",
    distinctId: userId,
    properties: {
      scout_id: scoutId,
      execution_id: executionId,
      scout_title: scoutTitle,
      error_message: errorMessage,
      duration_ms,
    },
  });
}

/**
 * Track email notification sent
 */
export async function trackEmailNotificationSent(
  userId: string,
  scoutId: string,
  executionId: string,
  scoutTitle: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await captureEvent({
    event: "scout_email_notification_sent",
    distinctId: userId,
    properties: {
      scout_id: scoutId,
      execution_id: executionId,
      scout_title: scoutTitle,
      success,
      error_message: errorMessage,
    },
  });
}

/**
 * Track duplicate result detected
 */
export async function trackDuplicateDetected(
  userId: string,
  scoutId: string,
  executionId: string,
  scoutTitle: string,
  similarityScore: number
): Promise<void> {
  await captureEvent({
    event: "scout_duplicate_detected",
    distinctId: userId,
    properties: {
      scout_id: scoutId,
      execution_id: executionId,
      scout_title: scoutTitle,
      similarity_score: similarityScore,
    },
  });
}
