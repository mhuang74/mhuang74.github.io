import type { CollectionEntry } from "astro:content";
import { getPath } from "@/utils/getPath";

export type PostEntry = CollectionEntry<"blog"> | CollectionEntry<"blogZhTw">;
export type WorkEntry = CollectionEntry<"work"> | CollectionEntry<"workZhTw">;

export const getPostHref = (entry: PostEntry): string =>
  entry.collection === "blogZhTw"
    ? `/zh-tw/posts/${entry.id}`
    : getPath(entry.id, entry.filePath);

export const getWorkHref = (entry: WorkEntry): string =>
  entry.collection === "workZhTw"
    ? `/zh-tw/work/${entry.id}`
    : `/work/${entry.id}`;
