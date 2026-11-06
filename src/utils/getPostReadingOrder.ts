import type { CollectionEntry } from "astro:content";
import getSortedPosts from "./getSortedPosts";

export const streamOfWorshipOrder = [
  "sow-intro",
  "sow-why-transitions-are-hard",
  "sow-catalog",
  "sow-lyrics-pipeline",
  "sow-analysis-pipeline",
  "sow-analysis-infrastructure",
  "sow-transition-engine",
  "sow-songset-constructor",
  "sow-webapp-architecture",
  "sow-offline-playback",
  "sow-android-client",
  "sow-retrospective",
  "lrc-detector-2-0-0",
];

/** Place the series at its most recently updated entry's position. */
const getPostReadingOrder = (posts: CollectionEntry<"blog">[]) => {
  const sortedPosts = getSortedPosts(posts);
  const seriesPosts = streamOfWorshipOrder.flatMap(id => {
    const post = sortedPosts.find(post => post.id === id);
    return post ? [post] : [];
  });
  let seriesInserted = false;

  return sortedPosts.flatMap(post => {
    if (!streamOfWorshipOrder.includes(post.id)) return [post];
    if (seriesInserted) return [];
    seriesInserted = true;
    return seriesPosts;
  });
};

export default getPostReadingOrder;
