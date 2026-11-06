import type { CollectionEntry } from "astro:content";
import { streamOfWorshipOrder } from "./getPostReadingOrder";

/** Keep series navigation in reading order and within the series. */
const getPostNavigation = (id: string, posts: CollectionEntry<"blog">[]) => {
  const navigationPosts = streamOfWorshipOrder.includes(id)
    ? streamOfWorshipOrder.flatMap(seriesId => {
        const post = posts.find(post => post.id === seriesId);
        return post ? [post] : [];
      })
    : posts;
  const currentIndex = navigationPosts.findIndex(post => post.id === id);

  return {
    prevPost: currentIndex > 0 ? navigationPosts[currentIndex - 1] : null,
    nextPost:
      currentIndex >= 0 ? (navigationPosts[currentIndex + 1] ?? null) : null,
  };
};

export default getPostNavigation;
