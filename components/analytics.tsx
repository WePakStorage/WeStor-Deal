"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let started = false;

/** PostHog: page views and key events only. No-op without a key. */
export function Analytics() {
  const path = usePathname();
  useEffect(() => {
    if (!key) return;
    if (!started) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: false,
        autocapture: false,
        persistence: "localStorage",
      });
      started = true;
    }
    posthog.capture("$pageview");
  }, [path]);
  return null;
}

export type AnalyticsEvent =
  | "signed_up" | "deal_created" | "om_uploaded" | "om_parsed" | "paywall_viewed" | "checkout_started"
  | "subscribed" | "buyer_imported" | "preview_generated" | "om_generated" | "subscription_cancelled"
  | "analysis_started" | "analysis_completed" | "offer_saved" | "team_created" | "bulk_scored";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (key && started) posthog.capture(event, props);
}
