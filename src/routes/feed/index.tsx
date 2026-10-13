import { createFileRoute } from "@tanstack/react-router";
import { VocabularyFeedPage } from "@/features/vocabulary/components/VocabularyFeedPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { resolveTarget, sitePageHead } from "@/features/vocabulary/lib/target-language";

export const Route = createFileRoute("/feed/")({
  ssr: "data-only",
  // No server on static hosts: resolve the deck from the address in the
  // browser, ask the server only while server-rendering (same as __root__).
  loader: async () => ({
    locale:
      typeof window === "undefined" ? await getSiteLocale() : resolveTarget(window.location.host),
  }),
  head: ({ loaderData }) => sitePageHead(loaderData?.locale),
  // The visited host picks both the deck and the on-screen title, so the loader's
  // locale rides along into the page instead of the brand defaulting to "anh".
  component: function VocabularyFeedRoute() {
    const { locale } = Route.useLoaderData();
    return <VocabularyFeedPage locale={locale} />;
  },
});
