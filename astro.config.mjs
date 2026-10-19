// @ts-check
import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Okapi's part of the config, typed and documented in core (src/core/astro/okapi.ts).
import { okapi, okapiAdapter, okapiSanity, okapiSite } from "./src/core/astro/okapi";

// The host adapter (Vercel/Netlify/Cloudflare, picked from where the build runs),
// only to run the editor chat's server function. A project with its own adapter
// passes that one instead: okapi({ adapter }) reads it.
const adapter = await okapiAdapter();

export default defineConfig({
  site: okapiSite(),
  // Static pages on any host. With a host adapter the one server route is the
  // editor chat; everything else is still prerendered.
  output: "static",
  adapter,
  integrations: [okapi({ adapter }), okapiSanity(), react()],
  image: {
    // Images come from Sanity's CDN (urlForImage), not astro:assets: no image
    // service, so `sharp` stays out of the chat's server function.
    service: passthroughImageService(),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
