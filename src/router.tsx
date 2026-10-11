import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Router base path, taken from Vite's `BASE_URL`.
 *
 * Locally this is `/`. When the app is deployed under a sub-path (the GitHub Pages
 * project site `/<repo>/`), the build sets Vite's `base` — and therefore `BASE_URL`
 * — to that prefix, so the router and every generated asset URL agree on where the
 * app lives. Trailing slashes are stripped to the empty base a root-hosted app uses.
 *
 * Routing uses clean browser-history URLs on every target. On GitHub Pages there is
 * no server rewrite, so unknown paths are answered with `404.html` — a build-time
 * copy of this same shell (see vite.config.ts) — which lets the router boot, read
 * the real `window.location.pathname`, and resolve the route. `?lang=` is part of
 * the real URL and therefore survives a deep link untouched.
 */
const basepath = import.meta.env.BASE_URL.replace(/\/+$/, "");

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    basepath: basepath || "/",
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
