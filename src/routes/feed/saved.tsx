import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/vocabulary/components/BookmarksPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, sitePageHead } from "@/features/vocabulary/lib/target-language";

// Saved words live in this browser's localStorage, so the page must never be
// server-rendered — an SSR pass would emit the empty state for every visitor.
export const Route = createFileRoute("/feed/saved")({
  ssr: "data-only",
  // No server on static hosts: resolve the deck from the address in the
  // browser, ask the server only while server-rendering (same as __root__).
  loader: async () => ({
    locale:
      typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) =>
    sitePageHead(loaderData?.locale, "あなたの語彙", "保存・お気に入りの語彙をこの端末に。"),
  component: BookmarksPage,
});
