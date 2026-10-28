// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://blog.zycbhb.top",
  devToolbar: { enabled: false },
  build: {
    format: "file",
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    sitemap({
      serialize(item) {
        const url = new URL(item.url);
        let pathname = url.pathname.replace(/\/index\.html$/, "/");
        if (pathname !== "/" && !pathname.endsWith("/") && !pathname.endsWith(".html") && !pathname.endsWith(".xml")) {
          pathname += ".html";
        }
        item.url = new URL(pathname, url.origin).href;
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
    },
  },
});


