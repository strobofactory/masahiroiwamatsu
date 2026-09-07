import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageCaption: z.string().optional(),
    lang: z.enum(['ja', 'en', 'es', 'zh', 'ko']).default('ja'),
    slug: z.string().optional(),
    translationKey: z.string().optional()
  }).superRefine((data, ctx) => {
    if (data.image && !data.imageAlt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageAlt'],
        message: 'image を指定する場合は imageAlt も指定してください。'
      });
    }
  })
});

export const collections = { notes };
