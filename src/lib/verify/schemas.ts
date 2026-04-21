import { z } from 'zod';

export const citationSchema = z.object({
  source: z.string().min(1),
  page: z.string().optional(),
});
export type Citation = z.infer<typeof citationSchema>;

export const fieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/, 'field key must be kebab-case'),
  label: z.string().min(1),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'date',
    'time',
    'checkbox',
    'select',
    'tel',
    'email',
    'url',
  ]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const sectionSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/, 'section key must be kebab-case'),
  label: z.string().min(1),
  description: z.string().optional(),
  repeat: z.number().int().positive().optional(),
  fields: z.array(fieldSchema).min(1),
});
export type Section = z.infer<typeof sectionSchema>;

export const matchingConfigSchema = z.object({
  require_cluster: z.boolean().optional(),
  cluster_min_labels: z.number().int().min(1).max(10).optional(),
  short_label_max_tokens: z.number().int().min(1).max(5).optional(),
  short_label_max_chars: z.number().int().min(1).max(20).optional(),
});
export type MatchingConfig = z.infer<typeof matchingConfigSchema>;

export const specLinkSchema = z.object({
  url: z.string().min(1),
  label: z.string().optional(),
  page: z.string().optional(),
});
export type SpecLink = z.infer<typeof specLinkSchema>;

export const sourceSpecSchema = z
  .object({
    module: z.string().regex(/^[0-9]+-[0-9]+$/, 'module must be like "1-9"'),
    template: z.string().regex(/^[a-z0-9-]+$/, 'template must be kebab-case'),
    title: z.string().min(1),
    citation: citationSchema,
    sections: z.array(sectionSchema).optional(),
    fields: z.array(fieldSchema).optional(),
    links: z.array(specLinkSchema).optional(),
    notes: z.string().optional(),
    last_verified: z.string().datetime().optional(),
    matching: matchingConfigSchema.optional(),
  })
  .refine((spec) => Boolean(spec.sections?.length || spec.fields?.length), {
    message: 'spec must define either sections or fields',
  })
  .refine((spec) => !(spec.sections?.length && spec.fields?.length), {
    message: 'spec cannot define both sections and fields',
  });
export type SourceSpec = z.infer<typeof sourceSpecSchema>;

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex string required');

export const sourceRegistryEntrySchema = z.object({
  source_hash: sha256Hex,
  content_hash: sha256Hex,
  drive_file_id: z.string().optional(),
  last_verified: z.string().datetime(),
});
export type SourceRegistryEntry = z.infer<typeof sourceRegistryEntrySchema>;

export const sourceRegistrySchema = z.object({
  sources: z.record(z.string(), sourceRegistryEntrySchema),
  meta_hash: sha256Hex.optional(),
});
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;

export const extractionMethodSchema = z.enum(['pdftotext', 'vision']);
export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;

export const extractionCacheEntrySchema = z.object({
  text: z.string(),
  extracted_at: z.string().datetime(),
  method: extractionMethodSchema,
  source_hash: sha256Hex.optional(),
});
export type ExtractionCacheEntry = z.infer<typeof extractionCacheEntrySchema>;

export const extractionCacheSchema = z.object({
  cache: z.record(z.string(), extractionCacheEntrySchema),
  meta_hash: sha256Hex.optional(),
});
export type ExtractionCache = z.infer<typeof extractionCacheSchema>;

export const accuracyBaselineEntrySchema = z.object({
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  measured_at: z.string().datetime(),
});
export type AccuracyBaselineEntry = z.infer<typeof accuracyBaselineEntrySchema>;

export const accuracyBaselineSchema = z.object({
  baselines: z.record(z.string(), accuracyBaselineEntrySchema),
});
export type AccuracyBaseline = z.infer<typeof accuracyBaselineSchema>;

export const verifyStatusSchema = z.enum([
  'pass',
  'missing_citation',
  'source_not_found',
  'source_unregistered',
  'source_drift',
  'content_drift',
  'field_drift',
  'needs_human_review',
  'extract_failed',
  'vision_api_failed',
  'spec_parse_error',
  'cache_corrupted',
  'drive_id_not_allowed',
]);
export type VerifyStatus = z.infer<typeof verifyStatusSchema>;

export const verifyReportEntrySchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative().optional(),
  source: z.string().optional(),
  status: verifyStatusSchema,
  message: z.string().optional(),
  drift: z
    .object({
      expected_fields: z.array(z.string()).optional(),
      actual_fields: z.array(z.string()).optional(),
      diff: z.array(z.string()).optional(),
    })
    .optional(),
});
export type VerifyReportEntry = z.infer<typeof verifyReportEntrySchema>;
