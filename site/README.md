# Codebytes Skills Catalog

Portable, tested agent skills for GitHub Copilot, Codex, Claude Code, Cursor, Gemini CLI, and other Agent Skills compatible hosts.

This Astro starter is a searchable catalog for reusable agent skills. It includes:

- Astro content collections with example skill entries
- Responsive grid and list views with persisted preferences
- Live search and detail pages
- Copy controls for install commands
- Light and dark themes
- Base-path-safe links for project and user GitHub Pages sites
- A least-privilege, SHA-pinned GitHub Pages workflow
- Placeholder thumbnails that are ready to replace

## Customize

1. Edit or remove the examples in `src/content/skills/`.
2. Add thumbnail files under `public/images/`.
3. Update each entry's `thumb`, `repoPath`, install commands, and descriptive content.
4. Replace `public/images/og.svg` and `public/favicon.svg` with your own artwork.

The content schema is in `src/content.config.ts`.

## Develop

Requires Node.js 24 or later and npm 11.10 or later.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The generated site uses `/skills/` and deploys to https://codebytes.github.io/skills/.

## Catalog identity

- Display name: Codebytes Skills Catalog
- Author: Chris Ayers
- Repository: `codebytes/skills`
- Package: `codebytes-skills`
- Marketplace: `codebytes-skills`

## Deploy

1. Push the generated project to `codebytes/skills`.
2. In repository settings, set Pages source to **GitHub Actions**.
3. Push to `main` or run the workflow manually on that branch.

The workflow grants top-level `contents: read`, build-job `pages: read`, and
deploy-job `pages: write` plus `id-token: write`.
