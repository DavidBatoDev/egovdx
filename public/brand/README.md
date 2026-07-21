# eSee LGU — Woven Band Asset Library

Static SVG brand assets built from Philippine indigenous weaving geometry
(Cordillera, Ilocano *inabel*, Visayan *hablon*, Mindanao textile traditions).
Loom-exact: every repeat is identical, every interval divides evenly into its
axis, and each file is self-contained flat-fill SVG with no gradients, filters,
shadows, or text.

**Palette (literal hex, used throughout):** Royal Blue `#0032A0` · Crimson Red
`#C8102E` · Golden Yellow `#FDDA25` · Rich Black `#25282A` · White `#FFFFFF`.

## Band library — `bands/`

Each band is `viewBox="0 0 200 1200"` and vertically seamless (the motif at
`y=0` continues cleanly when the band is stacked on itself at `y=1200`).

| File | viewBox | Repeat | Where it's used |
|---|---|---|---|
| `bands/band-01-diamond-warp.svg` | 0 0 200 1200 | 200 | Primary vertical band — hollow yellow diamonds with red centers on blue; source of the nav/letterhead diamond motif. |
| `bands/band-02-mountain-chevron.svg` | 0 0 200 1200 | 150 | Vertical accent band — white mountain chevrons on red with yellow edge rails; section dividers. |
| `bands/band-03-ladder.svg` | 0 0 200 1200 | 120 | Vertical band — blue ladder bars with red center squares on yellow; sidebar/section framing. |
| `bands/band-04-night-lozenge.svg` | 0 0 200 1200 | 60 | Dark vertical band — tight yellow lozenges on rich black with red rails; footer/high-contrast panels. |
| `bands/band-05-warp-lines.svg` | 0 0 200 1200 | 200 | Vertical band — triple white warp lines with solid yellow blocks on blue; quiet-variant source for `band-sidebar.svg`. |
| `bands/band-06-alternating-triangle.svg` | 0 0 200 1200 | 300 | Vertical band — alternating red/blue up/down triangles on white with 2px blue borders; decorative dividers. |
| `bands/band-07-bar-and-dot.svg` | 0 0 200 1200 | 150 | Vertical band — yellow bars with centered black dots on red; tabular/list framing. |
| `bands/band-08-nested-diamond.svg` | 0 0 200 1200 | 200 | Vertical band — white diamonds with nested yellow diamonds on blue; feature/hero framing. |
| `bands/patterns.svg` | 0 0 200 1200 | — | The 8 bands as `<pattern>` defs (`id="band-01"` … `band-08`), each sized to one repeat cell, for referencing as `fill="url(#band-0x)"` elsewhere. |

## Signature element

| File | viewBox | Where it's used |
|---|---|---|
| `tinagu-row.svg` | 0 0 1600 120 | The brand's signature *tinagu* terminator — 8 stylized human figures (circle head, body bar, crossing arms) evenly spaced at 200px, one under each band column, with a tapering diamond-loop cord above each. Figures cycle blue/red/yellow/black. Closes band walls and section dividers. |

## Derived compositions

| File | viewBox | Where it's used |
|---|---|---|
| `rule-nav.svg` | 0 0 1920 160 | Horizontal diamond rule (band-01 logic rotated 90°, simplified to solid yellow diamonds for legibility). Renders 6–8px tall under the nav bar; horizontally seamless. |
| `band-sidebar.svg` | 0 0 200 1200 | Quiet daily-use variant of band-05 — blue at 12% over white, white lines at 60% — as a low-contrast sidebar rail that won't compete with UI content. |
| `tile-subtle.svg` | 0 0 512 512 | Faint diamond-lattice background tile (blue at 5% on white), seamlessly tileable in both directions; light enough for 14px body text on top. |
| `divider-section.svg` | 0 0 1920 300 | Full-width section divider — band-01, band-02, band-05 side by side (640px each, y=0–200) with the tinagu row scaled beneath (y=200–300). |
| `letterhead-strip.svg` | 0 0 2480 200 | A4 print header at 300dpi. Left 400px left white for the LGU seal; remaining 2080px carries the rule-nav diamond motif; 3px blue hairline along the bottom edge. |
| `hero-band-wall.svg` | 0 0 1920 1080 | Marketing hero — all 8 bands hung side by side (200px wide, 40px white gutters, y=0–860) with the tinagu row beneath (y=860–1000), centered horizontally on white. |

## Also in this folder (not part of the woven-band library)

`dict-logo.png`, `egovph-logo.png` — official partner marks displayed as
institutional endorsement in the nav and footer.
