/**
 * Content Collections Configuration
 *
 * Defines schemas for CMS-managed content:
 * - modules: Module metadata (YAML files)
 * - sections: Section content with interactive components (MDX files)
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

const sections = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/sections' }),
  schema: z.object({
    number: z.string(),
    title: z.string(),
    module: z.string(),
    slug: z.string(),
    moduleKey: z.string(),
    contentType: z.enum(['guide-table', 'todo-list', 'editable-table', 'informational']),
    pdfFilename: z.string().optional(),
    resourcesUrl: z.string().url().optional(),
  }),
});

export const collections = { modules, sections };
