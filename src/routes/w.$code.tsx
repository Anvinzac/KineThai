import { createFileRoute } from "@tanstack/react-router";
import { ChallengePage } from "@/features/vocabulary/components/ChallengePage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";
import { DEFAULT_LOCALE } from "@/features/vocabulary/lib/locale";
import { t } from "@/features/vocabulary/lib/ui-copy";

export const Route = createFileRoute("/w/$code")({
  // The code resolves against this browser's bundled deck, so there is nothing to
  // load server-side; only the locale, for the title.
  loader: async () => ({ locale: await getSiteLocale() }),
  // DELIBERATELY generic. These tags are what a chat app renders as a link
  // preview, so putting the word (or anything derived from it) here would spoil
  // the guess before the receiver even taps.
  head: ({ loaderData }) => {
    const target = loaderData?.locale;
    const ui = target && target !== "en" ? target : DEFAULT_LOCALE;
    return sitePageHead(target, t(ui, "share.title"), t(ui, "challenge.headBody"));
  },
  component: ChallengePage,
});
