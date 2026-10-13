import { createFileRoute } from "@tanstack/react-router";
import { VocabLibraryPage } from "@/features/vocabulary/components/VocabLibraryPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, sitePageHead } from "@/features/vocabulary/lib/target-language";

// The library is a static discovery surface over mock pack metadata, so it never
// needs SSR — render it client-side like its /feed/saved sibling.
export const Route = createFileRoute("/feed/library")({
  ssr: "data-only",
  // No server on static hosts: resolve the deck from the address in the
  // browser, ask the server only while server-rendering (same as __root__).
  loader: async () => ({
    locale:
      typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) =>
    sitePageHead(
      loaderData?.locale,
      "語彙ライブラリ",
      "分野・目的・レベル別の専門パック。日々のランダム配信を補完します。",
    ),
  component: VocabLibraryPage,
});
