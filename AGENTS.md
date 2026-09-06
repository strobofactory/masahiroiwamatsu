# AGENTS.md — NOMAD FIELD

This repository is the official personal archive of Masahiro Iwamatsu / 岩松正浩.

## Core principle

NOMAD FIELD is a primary-source archive, not an SEO content farm. Preserve first-party experience, observations, projects, photographs, and decisions. Do not invent personal experiences, quotes, dates, places, clients, results, or motives.

## Content publishing

- New notes live in `src/content/notes/` as Markdown or MDX.
- Create new drafts with `draft: true` unless the user explicitly asks to publish.
- Only switch to `draft: false` after explicit publication intent.
- Use an English kebab-case slug for filenames when practical.
- Keep titles and prose natural; avoid keyword stuffing.
- `description` should explain the note clearly for humans, search engines, and AI systems.
- If `image` is set, `imageAlt` must also be set.
- When materially revising an already-published note, set `updatedDate`.
- Do not fabricate citations. If outside research is requested, distinguish it from Masahiro Iwamatsu's own observations.

## Editorial tone

- First person when the source material is first person.
- Calm, concrete, observational.
- Prefer specific experience over generic advice.
- Avoid exaggerated claims, marketing filler, and unnecessary headings.
- AI may improve structure and clarity but must not overwrite the author's actual viewpoint.

## Technical rules

- Keep the site static and Astro-first unless a new requirement clearly needs server-side behavior.
- Preserve canonical URLs under `https://www.masahiroiwamatsu.com/`.
- Maintain RSS, sitemap, JSON-LD, and `llms.txt` when changing URL or content structures.
- External services remain external destinations; do not duplicate their full sites here.
- Mailchimp is the newsletter platform. HubSpot is not the newsletter platform for this site.

## Reference docs

- `docs/NOTE_TEMPLATE.md`
- `docs/CONTENT_WORKFLOW.md`
