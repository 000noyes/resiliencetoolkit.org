# Contributing — Resilience Hub Toolkit

This toolkit is open source and designed to be forked and adapted by other communities.

## Fork and deploy your own instance

**1. Fork the repository**

Visit [github.com/000noyes/resiliencetoolkit.org](https://github.com/000noyes/resiliencetoolkit.org) and click **Fork**.

```bash
git clone https://github.com/YOUR-ORG/resiliencetoolkit.org.git
cd resiliencetoolkit.org/resiliencetoolkit.org
pnpm install
pnpm dev        # preview at localhost:4321
```

**2. Edit the content**

Content lives in `.astro` files — no CMS required. The main places to localize:

| File | What to change |
|------|---------------|
| `src/pages/index.astro` | Hero copy, origin story |
| `src/pages/about.astro` | Organization name, contact info, acknowledgements |
| `src/pages/map.astro` | Regional GIS data or resource map |
| `src/pages/modules/knowing-your-community/` | Local directory links |
| Any module section page | External links to local agencies and resources |

Module section pages are in `src/pages/modules/`. Each is a self-contained `.astro` file with interactive `<Todo>` and `<DataTable>` components. Edit the surrounding copy and links; the interactive components work without any changes.

**3. Deploy to Cloudflare Pages**

Connect your GitHub fork to [Cloudflare Pages](https://pages.cloudflare.com):

- Build command: `pnpm build`
- Build output directory: `dist`
- Node version: 20+

Once your domain is attached, two settings on it:

- Turn off Email Address Obfuscation (under the domain's security settings)
  and Automatic HTTPS Rewrites (under SSL/TLS, Edge Certificates). Leave
  Rocket Loader off. While any of the three is on, Cloudflare rewrites each
  HTML page on the way out and drops its ETag. Without the tag a page can
  never answer 304, so a browser's saved-copy check and the refill after a
  deploy cost a full page instead of about 1 KB. Cloudflare leaves the
  `*.pages.dev` address alone; only the custom domain is affected.
- After the first deploy, and after any change to those settings, run
  `node scripts/check-page-etags.mjs https://your-domain`. It fails when a
  page carries no tag or does not answer 304 to its own tag.

Cloudflare Pages auto-deploys on push to your default branch. The site is fully static — no server required.

**4. Service worker cache**

The build handles this automatically. `pnpm build` generates the correct `PRECACHE_ASSETS` list in `dist/sw.js` from the actual built routes and bumps `CACHE_VERSION` to a build timestamp (e.g. `v-build-20260329152126`). No manual changes to `public/sw.js` are needed on deploy.

---

## How to add a new section

1. Create a new `.astro` file in `src/pages/modules/<module-name>/` (e.g. `1-14.astro`). Copy an existing section file as a starting point.
2. Add the new `moduleKey` to `src/data/modules.ts`.
3. Set the section's `number`, `title`, and navigation via the inline `const sectionData` object at the top of the new `.astro` file (it is passed to `<ModuleLayout sectionData={sectionData}>`). Section metadata lives inline on each page, not in a separate data file.
4. Run `pnpm build` — the service worker precache updates automatically.

> [!WARNING]
> **Never rename a `moduleKey`.** The `moduleKey` is part of the IndexedDB composite key (`${moduleKey}-${todoId}`) used to store every checkbox and table entry for that section. Renaming a key destroys all stored data for anyone who has used that section. Adding new keys is safe. Renaming or removing existing keys is not.
>
> The canonical set of moduleKeys is enforced by `src/lib/data-preservation.test.ts`. Any rename will fail this test.

---

## Versioning

Releases follow three-part semantic versioning: MAJOR.MINOR.PATCH, in the
`VERSION` file and `package.json` together, with a matching `CHANGELOG.md`
entry.

- MAJOR 1.0.0 is declared when the toolkit can be relied on in the field:
  offline use and cross-device sync both live. Until then the major stays 0.
- MINOR for a new capability a reader can notice (a reading surface, search,
  sync).
- PATCH for polish, fixes, and hotfixes to a shipped release.

Versions before 0.1.0 used a four-part number; those entries stay as written.

The package manager is pinned via `package.json`'s `packageManager` field
(`pnpm@10.30.3`) so contributors get a deterministic toolchain.

---

## Contributing back to this repo

Bug reports and pull requests are welcome.

- Open an issue to discuss significant changes before submitting a PR.
- Keep PRs focused — one logical change per PR.
- Run `pnpm build` and `pnpm vitest run` before submitting.

**Contact:** [resiliencetoolkit@gocros.org](mailto:resiliencetoolkit@gocros.org)
