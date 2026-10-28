import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../dist");
const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) pages.push(full);
  }
}

const pages = [];
walk(root);

for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|javascript:|data:|#)/.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target =
      clean === "/"
        ? path.join(root, "index.html")
        : clean.endsWith("/")
          ? path.join(root, clean.slice(1), "index.html")
          : path.join(root, clean.replace(/^\//, ""));
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(root, page)}: missing ${ref}`);
    }
  }
}

const sitemap = path.join(root, "sitemap-0.xml");
if (fs.existsSync(sitemap)) {
  const xml = fs.readFileSync(sitemap, "utf8");
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1]);
    const target =
      url.pathname === "/"
        ? path.join(root, "index.html")
        : path.join(root, decodeURIComponent(url.pathname.slice(1)));
    if (!fs.existsSync(target)) errors.push(`sitemap: missing ${match[1]}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Checked ${pages.length} pages: all local links and sitemap URLs OK`);
