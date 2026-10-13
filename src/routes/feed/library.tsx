import { createFileRoute } from "@tanstack/react-router";
import { VocabLibraryPage } from "@/features/vocabulary/components/VocabLibraryPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

// The library is a static discovery surface over mock pack metadata, so it never
// needs SSR — render it client-side like its /feed/saved sibling.
export const Route = createFileRoute("/feed/library")({
  ssr: "data-only",
  loader: async () => ({ locale: await getSiteLocale() }),
  head: ({ loaderData }) =>
    sitePageHead(
      loaderData?.locale,
      "語彙ライブラリ",
      "分野・目的・レベル別の専門パック。日々のランダム配信を補完します。",
    ),
  component: VocabLibraryPage,
});
