import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/vocabulary/components/BookmarksPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

// Saved words live in this browser's localStorage, so the page must never be
// server-rendered — an SSR pass would emit the empty state for every visitor.
export const Route = createFileRoute("/feed/saved")({
  ssr: "data-only",
  loader: async () => ({ locale: await getSiteLocale() }),
  head: ({ loaderData }) =>
    sitePageHead(loaderData?.locale, "あなたの語彙", "保存・お気に入りの語彙をこの端末に。"),
  component: BookmarksPage,
});
