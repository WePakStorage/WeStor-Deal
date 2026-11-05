import "server-only";
import type { AnalyticsEvent } from "@/components/analytics";

/** Server-side capture (e.g. from webhooks) via PostHog's public capture endpoint. */
export async function trackServer(event: AnalyticsEvent, distinctId: string, properties: Record<string, unknown> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties }),
    });
  } catch {
    // analytics must never break a request
  }
}
