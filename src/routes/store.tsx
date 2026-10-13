import { createFileRoute } from "@tanstack/react-router";
import { StorePage } from "@/features/ecosystem/components/StorePage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, sitePageHead } from "@/features/vocabulary/lib/target-language";

export const Route = createFileRoute("/store")({
  // No server on static hosts: resolve the deck from the address in the
  // browser, ask the server only while server-rendering (same as __root__).
  loader: async () => ({
    locale:
      typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) =>
    sitePageHead(
      loaderData?.locale,
      "Chay Lá ストア",
      "Chay Lá 家の全アプリをスクリーンショットと説明つきで。",
    ),
  component: StorePage,
});
