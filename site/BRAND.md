# skald — brand assets

All assets are SVG. Drop them into `assets/`, `docs/`, or `gh-pages/` as needed.

## Files

| File | Use |
|---|---|
| `mark.svg` | Mark only (rune + arcs), light backgrounds. Default for README. |
| `mark-dark.svg` | Mark only, dark backgrounds. Use with `<picture>` for theme-aware READMEs. |
| `logo.svg` | Mark + wordmark, horizontal lockup, light bg. |
| `logo-dark.svg` | Mark + wordmark, horizontal lockup, dark bg. |
| `avatar.svg` | Square 220×220 with cream bg. GitHub org/user avatar, npm package, social. |
| `avatar-dark.svg` | Square 220×220 with slate bg. Same purposes, dark variant. |
| `favicon.svg` | Simplified mark for tiny sizes (16–32px). One arc only. |
| `social-card.svg` | 1280×640 OG image / GitHub repo social preview. |
| `index.html` | Self-contained one-pager for `gh-pages`. No build, no JS deps. |

## README integration

Theme-aware logo in your README:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img src="assets/logo.svg" alt="skald" width="320">
</picture>
```

## Avatar / social preview

For the GitHub repo social preview (Settings → General → Social preview), you'll need a PNG. Convert with:

```bash
# requires inkscape or rsvg-convert
rsvg-convert -w 1280 social-card.svg > social-card.png
# or
inkscape social-card.svg -o social-card.png -w 1280
```

For the GitHub avatar, GitHub will accept the SVG directly in many places, but for the user/org avatar upload you'll need PNG:

```bash
rsvg-convert -w 460 avatar.svg > avatar.png
```

## Wordmark note

The `logo*.svg` files set the wordmark via `<text>` with a system font stack. This renders correctly in browsers and on GitHub but will fall back to whatever sans-serif the viewer has. If you want pixel-perfect letterforms across all platforms, open the SVG in Figma/Inkscape/Illustrator and convert the text to outlines (paths).

## Colors

| Token | Light | Dark |
|---|---|---|
| Rune | `#0f172a` (slate-900) | `#faf6ed` (cream) |
| Arcs | `#d97706` (amber-600) | `#f59e0b` (amber-500) |
| Background | `#faf6ed` (cream) | `#0f172a` (slate-900) |

## The mark

The mark is the Ansuz rune (ᚨ) — Elder Futhark, meaning "mouth" or "speech," associated with Odin (patron of skalds). Three concentric arcs share a focal point at the midpoint between the branch tips, representing the broadcast.

## gh-pages deploy

```bash
git checkout --orphan gh-pages
git rm -rf .
cp index.html favicon.svg social-card.svg .
git add index.html favicon.svg social-card.svg
git commit -m "gh-pages: initial deploy"
git push origin gh-pages
```

Then in GitHub: Settings → Pages → source: `gh-pages` branch.

Update the `https://github.com/yourname/skald` links in `index.html` before deploying.
