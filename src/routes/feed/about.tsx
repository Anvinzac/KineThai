import { createFileRoute } from "@tanstack/react-router";
import { AppInfoPage } from "@/features/vocabulary/components/AppInfoPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, sitePageHead } from "@/features/vocabulary/lib/target-language";

// Reached from the top row of the feed's Settings sheet. Static copy, but the brand and the
// highlighted language follow the visited address, so the loader's locale rides along.
export const Route = createFileRoute("/feed/about")({
  ssr: "data-only",
  loader: async () => ({
    locale:
      typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) =>
    sitePageHead(
      loaderData?.locale,
      "アプリ情報",
      "実験版、AI生成コンテンツ、ロードマップ、専門協力のご案内。",
    ),
  component: function AppInfoRoute() {
    const { locale } = Route.useLoaderData();
    return <AppInfoPage locale={locale} />;
  },
});
