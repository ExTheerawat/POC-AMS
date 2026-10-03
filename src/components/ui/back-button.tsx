"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";

/**
 * Browser-history back button — uses router.back() so the previous page is
 * restored from history (scroll position, filters, etc.), not refetched.
 *
 * If there's no history entry (e.g. user opened the page directly from a link),
 * falls back to the optional `fallback` href.
 */
export function BackButton({
  fallback,
  label = "กลับ",
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    // If there's prior history within this tab, use it; otherwise fall back to the given route.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (fallback) {
      router.push(fallback);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={goBack} className={className}>
      <ArrowLeft className="h-4 w-4" /> {label}
    </Button>
  );
}
