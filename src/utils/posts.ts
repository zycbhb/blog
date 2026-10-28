import { getCollection } from "astro:content";

type Posts = Awaited<ReturnType<typeof getCollection<"posts">>>;
export type Post = Posts[number];

const TAG_SLUGS: Record<string, string> = {
  Cloudflare: "cloudflare",
  Tunnel: "tunnel",
  Alpine: "alpine",
  nginx: "nginx",
  Docker: "docker",
  监控: "monitoring",
  IPv6: "ipv6",
  DNS: "dns",
  组网: "network",
  EasyTier: "easytier",
  硬件: "hardware",
  自托管: "selfhost",
  mihomo: "mihomo",
};

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort((a, b) => {
    const byDate = b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

export function postSlug(post: Post): string {
  return post.id.replace(/\.md$/, "");
}

export function postUrl(post: Post): string {
  return `/posts/${postSlug(post)}.html`;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
}

export function tagSlug(tag: string): string {
  return TAG_SLUGS[tag] ?? encodeURIComponent(tag);
}

export function tagId(tag: string): string {
  return `tag-${tagSlug(tag)}`;
}

export function tagCounts(posts: Post[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export function postsByTag(posts: Post[]): Array<{ tag: string; posts: Post[] }> {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const list = groups.get(tag) ?? [];
      list.push(post);
      groups.set(tag, list);
    }
  }
  return [...groups.entries()]
    .map(([tag, list]) => ({ tag, posts: list }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "zh-CN"));
}
