/**
 * Content Collections Configuration
 *
 * - sourceSpecs: Per-template source specs (Markdown + YAML frontmatter)
 *
 * @see https://docs.astro.build/en/guides/content-collections/
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { sourceSpecSchema } from './lib/verify/schemas';

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

export const collections = { sourceSpecs };
