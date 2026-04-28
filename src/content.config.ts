/**
 * Content Collections Configuration
 *
 * - modules: Module metadata (YAML)
 * - sourceSpecs: Per-template source specs (Markdown + YAML frontmatter)
 *
 * @see https://docs.astro.build/en/guides/content-collections/
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { sourceSpecSchema } from './lib/verify/schemas';

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

const sourceSpecs = defineCollection({
  // Exclude README.md — it's the spec-author's guide, not a spec entry.
  // Day-15-k added it as the canonical reference for require_cluster /
  // tableId / prose_scope opt-out patterns.
  loader: glob({
    pattern: ['**/*.md', '!README.md'],
    base: './docs/source-specs',
  }),
  schema: sourceSpecSchema,
});

export const collections = { modules, sourceSpecs };
