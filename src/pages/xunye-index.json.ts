import { getPosts, postUrl } from "../utils/posts";

export async function GET() {
  const posts = await getPosts();
  return Response.json(posts.map(post => ({
    title: post.data.title, url: postUrl(post), tags: post.data.tags,
    summary: post.data.summary || post.data.description,
    text: (post.body || "").replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, "").slice(0, 5000)
  })));
}
