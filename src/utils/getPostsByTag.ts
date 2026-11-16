import getSortedPosts from "./getSortedPosts";
import { slugifyAll } from "./slugify";
import type { PostEntry } from "./entryPath";

const getPostsByTag = (posts: PostEntry[], tag: string) =>
  getSortedPosts(
    posts.filter(post => slugifyAll(post.data.tags).includes(tag))
  );

export default getPostsByTag;
