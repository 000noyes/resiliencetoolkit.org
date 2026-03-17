/**
 * Keystatic CMS Configuration
 *
 * Defines the content editing interface for non-developer editors.
 * Content is stored as MDX/YAML files in the Git repo.
 *
 * Admin UI available at /keystatic when running `astro dev`.
 */
import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    sections: collection({
      label: 'Sections',
      slugField: 'slug',
      path: 'src/content/sections/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        number: fields.text({ label: 'Section Number', description: 'e.g., "1.1", "2.3"' }),
        title: fields.text({ label: 'Title' }),
        module: fields.text({ label: 'Module ID', description: 'e.g., "emergency-preparedness"' }),
        slug: fields.text({ label: 'URL Slug', description: 'e.g., "1-1", "2-3"' }),
        moduleKey: fields.text({
          label: 'Module Key',
          description: 'Storage key for IndexedDB. CRITICAL: changing this loses user data!',
        }),
        contentType: fields.select({
          label: 'Content Type',
          options: [
            { label: 'Guide Table (Systems/Stuff)', value: 'guide-table' },
            { label: 'Todo List', value: 'todo-list' },
            { label: 'Editable Table', value: 'editable-table' },
            { label: 'Informational', value: 'informational' },
          ],
          defaultValue: 'guide-table',
        }),
        pdfFilename: fields.text({ label: 'PDF Filename', description: 'Optional PDF file in /toolkit/sections/' }),
        resourcesUrl: fields.url({ label: 'Resources URL', description: 'Google Drive folder URL (optional)' }),
        content: fields.mdx({ label: 'Content' }),
      },
    }),
    modules: collection({
      label: 'Modules',
      slugField: 'slug',
      path: 'src/content/modules/*',
      format: { data: 'yaml' },
      schema: {
        slug: fields.text({ label: 'Slug' }),
        title: fields.text({ label: 'Title' }),
        order: fields.number({ label: 'Display Order' }),
        icon: fields.text({ label: 'Lucide Icon Name', description: 'e.g., "Siren", "HeartPulse"' }),
        phases: fields.multiselect({
          label: 'Phases',
          options: [
            { label: 'Before', value: 'Before' },
            { label: 'During', value: 'During' },
            { label: 'After', value: 'After' },
          ],
        }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value || 'New tag',
        }),
        basePath: fields.text({ label: 'Base Path', description: 'e.g., "/modules/emergency-preparedness"' }),
        sections: fields.array(
          fields.object({
            slug: fields.text({ label: 'Slug', description: 'e.g., "1-1"' }),
            number: fields.text({ label: 'Number', description: 'e.g., "1.1"' }),
            title: fields.text({ label: 'Title' }),
          }),
          {
            label: 'Section Order',
            itemLabel: (props) => `${props.fields.number.value} ${props.fields.title.value}` || 'New section',
            description: 'Ordered list of sections. Determines prev/next navigation.',
          },
        ),
      },
    }),
  },
});
