import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const skills = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/skills" }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    useWhen: z.string(),
    repoPath: z.string(),
    gallery: z.string().url().optional(),
    thumb: z.string(),
    install: z.array(z.object({ label: z.string(), cmd: z.string() })),
    order: z.number().default(99),
  }),
});

export const collections = { skills };
