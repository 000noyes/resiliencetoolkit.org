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

**4. Bump the service worker version on each deploy**

`public/sw.js` has a version string at the top:

```js
const CACHE_VERSION = 'v28-minimal';
```

Increment this on every deploy so returning visitors get fresh content instead of a stale cache. Example: `v29`, `v30`, etc.

---

## Contributing back to this repo

Bug reports and pull requests are welcome.

- Open an issue to discuss significant changes before submitting a PR.
- Keep PRs focused — one logical change per PR.
- Run `pnpm build` and `pnpm vitest run` before submitting.

**Contact:** [resiliencetoolkit@gocros.org](mailto:resiliencetoolkit@gocros.org)
