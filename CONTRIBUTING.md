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

Module section pages are in `src/pages/modules/`. Each is a self-contained `.astro` file with interactive `<Todo>` and `<EditableTable>` components. Edit the surrounding copy and links; the interactive components work without any changes.

**3. Deploy to Cloudflare Pages**

Connect your GitHub fork to [Cloudflare Pages](https://pages.cloudflare.com):

- Build command: `pnpm build`
- Build output directory: `dist`
- Node version: 20+

Cloudflare Pages auto-deploys on push to your default branch. The site is fully static — no server required.

**4. Service worker cache**

The build handles this automatically. `pnpm build` generates the correct `PRECACHE_ASSETS` list in `dist/sw.js` from the actual built routes and bumps `CACHE_VERSION` to a build timestamp (e.g. `v-build-20260329152126`). No manual changes to `public/sw.js` are needed on deploy.

---

## How to add a new section

1. Create a new `.astro` file in `src/pages/modules/<module-name>/` (e.g. `1-14.astro`). Copy an existing section file as a starting point.
2. Add the new `moduleKey` to `src/data/modules.ts`.
3. Add a section entry to the relevant `src/content/modules/*.yaml` file (controls section order, title, and slug).
4. Run `pnpm build` — the service worker precache updates automatically.

> [!WARNING]
> **Never rename a `moduleKey`.** The `moduleKey` is part of the IndexedDB composite key (`${moduleKey}-${todoId}`) used to store every checkbox and table entry for that section. Renaming a key destroys all stored data for anyone who has used that section. Adding new keys is safe. Renaming or removing existing keys is not.
>
> The canonical set of moduleKeys is enforced by `src/lib/data-preservation.test.ts`. Any rename will fail this test.

---

## Contributing back to this repo

Bug reports and pull requests are welcome.

- Open an issue to discuss significant changes before submitting a PR.
- Keep PRs focused — one logical change per PR.
- Run `pnpm build` and `pnpm vitest run` before submitting.

**Contact:** [resiliencetoolkit@gocros.org](mailto:resiliencetoolkit@gocros.org)
