import { getCollection } from "astro:content";
import getSortedPosts from "@/utils/getSortedPosts";
import type { PostEntry } from "@/utils/entryPath";

export interface ListedPost {
  entry: PostEntry;
  isEnglishOnly: boolean;
}

/** English order, with translated entries swapped in where they exist. */
export const getZhListing = async (): Promise<ListedPost[]> => {
  const [zh, en] = await Promise.all([
    getCollection("blogZhTw"),
    getCollection("blog"),
  ]);
  const zhById = new Map(zh.map(post => [post.id, post]));

  return getSortedPosts(en).map(entry => {
    const translated = zhById.get(entry.id);
    return {
      entry: translated ?? entry,
      isEnglishOnly: !translated,
    };
  });
};
