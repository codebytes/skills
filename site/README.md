# Codebytes Skills Catalog

Portable, tested agent skills for GitHub Copilot, Codex, Claude Code, Cursor, Gemini CLI, and other Agent Skills compatible hosts.

This Astro site is the searchable catalog for the canonical skills in `../skills/`. It includes:

- Astro content collections with registered skill entries
- Responsive grid and list views with persisted preferences
- Live search and detail pages
- Copy controls for install commands
- Light and dark themes
- Base-path-safe links for project and user GitHub Pages sites
- A least-privilege, SHA-pinned GitHub Pages workflow
- Thumbnails generated from canonical skill copies before development and builds

## Customize

1. Add self-contained packages under `skills/<name>/`, following the existing skills.
2. Run the repository's managed sync lifecycle after adding or removing skills.
3. Keep catalog metadata under `src/content/skills/` aligned with canonical skill
   names, install commands, and source paths.
4. Edit the skill's `thumbnail.png`; `npm run dev` and `npm run build` generate
   ignored `public/images/thumb-<name>.png` copies automatically.
5. Edit layouts, components, `public/images/og.svg`, and `public/favicon.svg` for
   site-level presentation changes.

The content schema is in `src/content.config.ts`.

## Develop

Requires Node.js 24 or later and npm 11.10 or later.

```sh
npm ci --ignore-scripts
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The configured canonical site is <https://chris-ayers.com/skills/>. The
`codebytes.github.io/skills/` Pages address may redirect to that custom domain.

## Catalog identity

- Display name: Codebytes Skills Catalog
- Author: Chris Ayers
- Repository: `codebytes/skills`
- Package: `codebytes-skills`
- Marketplace: `codebytes-skills`

## Deploy

1. Review and approve publication before pushing to `codebytes/skills`.
2. In repository settings, set Pages source to **GitHub Actions**.
3. Push to `main` or run the workflow manually on that branch.

The workflow grants top-level `contents: read`, build-job `pages: read`, and
deploy-job `pages: write` plus `id-token: write`.
