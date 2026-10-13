import { createFileRoute } from "@tanstack/react-router";
import { StorePage } from "@/features/ecosystem/components/StorePage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

export const Route = createFileRoute("/store")({
  loader: async () => ({ locale: await getSiteLocale() }),
  head: ({ loaderData }) =>
    sitePageHead(
      loaderData?.locale,
      "Chay Lá ストア",
      "Chay Lá 家の全アプリをスクリーンショットと説明つきで。",
    ),
  component: StorePage,
});
