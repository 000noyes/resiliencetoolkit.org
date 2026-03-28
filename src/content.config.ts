/**
 * Content Collections Configuration
 *
 * Defines schemas for CMS-managed content:
 * - modules: Module metadata (YAML files)
 *
 * Note: sections collection removed — all sections are hardcoded .astro pages.
 * MDX migration deferred to glass-box-expanded branch.
 *
 * @see https://docs.astro.build/en/guides/content-collections/
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const modules = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/modules' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    order: z.number(),
    icon: z.string(),
    phases: z.array(z.enum(['Before', 'During', 'After'])).optional(),
    summary: z.string(),
    tags: z.array(z.string()),
    basePath: z.string(),
    sections: z.array(z.object({
      slug: z.string(),
      number: z.string(),
      title: z.string(),
    })),
  }),
});

export const collections = { modules };
