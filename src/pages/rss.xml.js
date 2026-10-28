import rss from "@astrojs/rss";
import { getPosts, postUrl } from "../utils/posts";

export async function GET(context) {
  const posts = await getPosts();

  return rss({
    title: "监视者日志 · OVERSEER.LOG",
    description: "记录两台小服务器、一条隧道和无数次重启。",
    site: context.site,
    customData: "<language>zh-CN</language>",
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: postUrl(post),
    })),
  });
}
