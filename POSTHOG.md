# PostHog Integration

Open Scouts uses [PostHog](https://posthog.com) for product analytics to understand how users interact with the platform and measure product health.

## What We Track

### User Journey
We track the complete user journey from signup to becoming an active user:

1. **Authentication** - Sign up, login, and OAuth flows
2. **Scout Creation** - When users create new monitoring scouts
3. **Configuration** - Progress through scout setup (goal, queries, location, frequency)
4. **Activation** - When scouts are enabled for automated monitoring
5. **Engagement** - Manual runs, viewing results, managing scouts

### Execution Metrics
Server-side tracking of scout execution performance:

- Execution success/failure rates
- Duration and step counts
- Duplicate detection (when results match previous runs)
- Email notification delivery

## Key Funnels

### Activation Funnel
Measures how effectively users go from signup to having an active scout:
```
Sign Up → Create Scout → Complete Configuration → Activate Scout
```

### Engagement Funnel
Measures ongoing user engagement:
```
View Results → Manual Trigger → Check Email Notification
```

## Product Health Metrics

| Metric | Description |
|--------|-------------|
| Execution Success Rate | % of scout runs that complete without errors |
| Duplicate Detection Rate | % of runs that find already-reported information |
| Configuration Completion | % of created scouts that get fully configured |
| Activation Rate | % of configured scouts that users actually turn on |
| Email Delivery Rate | % of notifications successfully sent |

## Setup

### Environment Variables
```env
NEXT_PUBLIC_POSTHOG_KEY=your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.posthog.com  # Optional
```

The PostHog key must also be available to Supabase edge functions for server-side tracking.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  posthog-js (instrumentation-client.ts)             │    │
│  │  - User identification                              │    │
│  │  - Page views & UI interactions                     │    │
│  │  - Client-side events                               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  posthog-node (lib/posthog-server.ts)               │    │
│  │  - Server-side event capture                        │    │
│  │  - API route tracking                               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase Edge Functions                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTP Capture API (supabase/functions/.../posthog.ts)│    │
│  │  - Execution lifecycle events                       │    │
│  │  - Email notification tracking                      │    │
│  │  - Performance metrics                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Events Reference

### Authentication
| Event | When |
|-------|------|
| `user_signed_up` | New account created |
| `user_logged_in` | Existing user logs in |
| `google_auth_initiated` | User clicks Google OAuth |

### Scout Management
| Event | When |
|-------|------|
| `scout_created` | New scout created |
| `scout_configuration_completed` | All required fields filled |
| `scout_activated` | Scout enabled for automation |
| `scout_deactivated` | Scout disabled |
| `scout_deleted` | Scout permanently removed |

### Execution (Server-Side)
| Event | When |
|-------|------|
| `scout_execution_started` | Execution begins |
| `scout_execution_completed` | Execution finishes successfully |
| `scout_execution_failed` | Execution errors out |
| `scout_duplicate_detected` | Results match previous run |
| `scout_email_notification_sent` | Email notification attempted |

### User Engagement
| Event | When |
|-------|------|
| `scout_execution_triggered` | User manually runs a scout |
| `scout_results_viewed` | User views execution results |
| `execution_history_cleared` | User clears execution history |

### Settings
| Event | When |
|-------|------|
| `test_email_sent` | User sends test notification |
| `firecrawl_key_regenerated` | User regenerates API key |
| `location_updated` | User changes default location |

## Adding New Events

### Client-Side
```typescript
import posthog from "posthog-js";

posthog.capture("event_name", {
  relevant_property: "value",
});
```

### Server-Side (API Routes)
```typescript
import { getPostHogClient } from "@/lib/posthog-server";

const posthog = getPostHogClient();
posthog.capture({
  distinctId: user.id,
  event: "event_name",
  properties: { ... },
});
```

### Edge Functions
```typescript
import { captureEvent } from "./posthog.ts";

captureEvent({
  event: "event_name",
  distinctId: userId,
  properties: { ... },
});
```

## Privacy Considerations

- User identification uses Supabase `user.id` (not email) as the primary identifier
- Email is stored as a user property for support purposes only
- No PII is included in event properties
- PostHog's proxy path (`/ingest`) is used to improve data collection reliability
