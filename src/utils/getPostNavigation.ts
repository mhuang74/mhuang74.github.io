import type { CollectionEntry } from "astro:content";

/** Follow the same reading order used by the posts listing. */
const getPostNavigation = (id: string, posts: CollectionEntry<"blog">[]) => {
  const currentIndex = posts.findIndex(post => post.id === id);

  return {
    prevPost: currentIndex > 0 ? posts[currentIndex - 1] : null,
    nextPost: currentIndex >= 0 ? (posts[currentIndex + 1] ?? null) : null,
  };
};

export default getPostNavigation;
