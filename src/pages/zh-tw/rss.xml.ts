import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import getSortedPosts from "@/utils/getSortedPosts";
import { getPostHref } from "@/utils/entryPath";
import { SITE } from "@/config";
import { t } from "@/i18n/ui";

export async function GET() {
  const posts = await getCollection("blogZhTw");
  const sortedPosts = getSortedPosts(posts);
  return rss({
    title: t("zh-tw", "rss.title"),
    description: t("zh-tw", "rss.desc"),
    site: SITE.website,
    customData: "<language>zh-Hant-TW</language>",
    items: sortedPosts.map(post => ({
      link: getPostHref(post),
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.modDatetime ?? post.data.pubDatetime),
    })),
  });
}
