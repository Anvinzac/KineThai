/**
 * Publish a shell's MEASURED height as a CSS custom property (`--vocab-vh` by default),
 * plus a `data-short-viewport` attribute when that height is short.
 *
 * The landscape chrome stack used to be derived from `15dvh`. `dvh` is the wrong
 * input for it on a phone: the dynamic viewport is re-resolved when the browser's
 * own chrome grows or shrinks, and on a rotation it can report the previous
 * orientation's value for a frame or more — Safari and Chrome on Android both do
 * this. Every length below it (the button row, the gap, the progress row, and the
 * answer page's word/meaning split that is derived from them) then lays out
 * against a height the card does not have, which is exactly the "landscape does
 * not behave like portrait" class of bug.
 *
 * A ResizeObserver on the shell reports the height the element was actually given,
 * after layout, so the chrome can never disagree with the box it sits in. The CSS
 * keeps `100dvh` as the fallback, which is what server render uses before this runs.
 *
 * The short-viewport tier is keyed on the same measurement for the same reason: a
 * `max-height` media query reads the viewport, which disagrees with the box during a
 * rotation's settle frames, and restates a breakpoint the cards also apply in JS. The
 * attribute is `"landscape"` when the shell is also wider than tall, `""` otherwise,
 * and absent above the threshold.
 *
 * Exports: useShellHeightVar
 * Depends on: react
 */
import { useLayoutEffect, type RefObject } from "react";

/**
 * Keep a custom property on `element` equal to its own measured height.
 * @param ref The shell element to measure and write onto.
 * @param options.shortMaxHeight Tallest height that sets `data-short-viewport`; omit to skip it.
 * @param options.property Custom property to write; defaults to `--vocab-vh`.
 */
export function useShellHeightVar(
  ref: RefObject<HTMLElement | null>,
  { shortMaxHeight, property = "--vocab-vh" }: { shortMaxHeight?: number; property?: string } = {},
): void {
  // Layout effect: on a client-rendered page the first paint already carries the
  // measured tier, so a landscape phone never flashes the portrait chrome.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let last = -1;
    let lastTier: string | null = null;
    let frame = 0;
    const write = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const height = Math.round(box.height);
      if (height <= 0) return;
      // Sub-pixel jitter from the URL bar would otherwise rewrite the property
      // every frame and invalidate layout for nothing.
      if (height !== last) {
        last = height;
        element.style.setProperty(property, `${height}px`);
      }
      if (shortMaxHeight === undefined) return;
      const tier = height > shortMaxHeight ? null : box.width > box.height ? "landscape" : "";
      if (tier !== lastTier) {
        lastTier = tier;
        if (tier === null) element.removeAttribute("data-short-viewport");
        else element.setAttribute("data-short-viewport", tier);
      }
    };
    // The observer writes at once: it runs after layout and before paint, so the frame it
    // reports is the frame that gets the new chrome. The window signals below can fire
    // several times in one frame during a rotation, so they coalesce to one read.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    write();
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      write();
    });
    observer.observe(element);
    // Deliberately redundant with the observer: a rotation can settle the new height a
    // frame after the observer fires, and the visual viewport moves on its own when the
    // keyboard or URL bar appears. `orientationchange` is deprecated but still the
    // earliest rotation signal on iOS Safari, so it stays.
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [ref, property, shortMaxHeight]);
}
