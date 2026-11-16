import { defineCollection, z, type ImageFunction } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";

const blogSchema = ({ image }: { image: ImageFunction }) =>
  z.object({
    author: z.string().default(SITE.author),
    pubDatetime: z.date(),
    modDatetime: z.date().optional().nullable(),
    title: z.string(),
    featured: z.boolean().optional(),
    draft: z.boolean().optional(),
    tags: z.array(z.string()).default(["others"]),
    ogImage: image().or(z.string()).optional(),
    description: z.string(),
    canonicalURL: z.string().optional(),
    hideEditPost: z.boolean().optional(),
    timezone: z.string().optional(),
  });

const workSchema = z.object({
  title: z.string(),
  role: z.string(),
  team: z.string().default("Solo"),
  stack: z.array(z.string()).default([]),
  outcomes: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  pubDatetime: z.date().optional(),
  description: z.string(),
});

const blog = defineCollection({
  loader: glob({
    pattern: ["**/[^_]*.{md,mdx}", "!zh-tw/**"],
    base: `./${BLOG_PATH}`,
  }),
  schema: ({ image }) => blogSchema({ image }),
});

const blogZhTw = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/data/blog/zh-tw" }),
  schema: ({ image }) =>
    blogSchema({ image }).extend({
      translationOf: z.string(),
      sourceUpdated: z.date(),
    }),
});

const work = defineCollection({
  loader: glob({
    pattern: ["**/[^_]*.{md,mdx}", "!zh-tw/**"],
    base: "./src/data/work",
  }),
  schema: workSchema,
});

const workZhTw = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/data/work/zh-tw" }),
  schema: workSchema.extend({
    translationOf: z.string(),
    sourceUpdated: z.date(),
  }),
});

export const collections = { blog, blogZhTw, work, workZhTw };
