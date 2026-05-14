# niwaki

[![npm version](https://img.shields.io/npm/v/niwaki.svg)](https://www.npmjs.com/package/niwaki)
[![license](https://img.shields.io/npm/l/niwaki.svg)](https://github.com/theanhgen/niwaki/blob/main/LICENSE)

Grow a pixel-art forest in your terminal every time you use Claude Code.

Each prompt plants a new tree. Each tree grows over time. Your forest evolves from a quiet clearing into an ancient woodland — and it never resets.

---

## Quick Start

```bash
bun add -g niwaki
niwaki init
niwaki
```

`niwaki init` creates `~/.niwaki/forest.json` and registers a `Stop` hook in `~/.claude/settings.json`. After that, a tree is planted after every Claude Code response. Open the viewer in a second terminal to watch them grow.

---

## Streaks

Niwaki tracks your coding streak — consecutive days where you use Claude Code.

- **Active streak**: The viewer and badge show your current streak count (e.g. `7-day streak`)
- **Broken streak**: Miss a day and your forest starts **wilting** — trees desaturate toward brown, and fog rolls in
- **Recovery**: Your next prompt resets the streak to 1 and clears the wilting immediately

| Days idle | Effect |
|----------:|--------|
| 1 | Light desaturation, sparse fog |
| 2 | Noticeable browning, moderate fog |
| 3 | Heavy browning, dense fog |
| 4+ | Near-dead forest, thick fog |

Plant a tree to bring it all back to life.

---

## Badge

```bash
niwaki badge
```

Creates `niwaki-badge.svg` in the current directory and prints the markdown to embed it:

```markdown
[![niwaki](./niwaki-badge.svg)](https://github.com/theanhgen/niwaki)
```

| State | Badge color | Example |
|-------|-------------|---------|
| Active streak | Green | `42 trees · 7d streak` |
| Wilting | Orange-red | `42 trees · wilting` |
| No streak data | Grey | `42 trees` |

Re-run `niwaki badge` any time to update the SVG with your latest stats.

---

## FOREST.md

```bash
niwaki badge && niwaki md
```

Creates `FOREST.md` in the current directory with your badge, stats, a plain-text forest rendering, and total prompts and forest age.

---

## Biomes

| Trees | Biome | What changes |
|------:|-------|-------------|
| 0–9 | Clearing | Sparse stars, light ground |
| 10–24 | Grove | More stars, richer ground |
| 25–49 | Woodland | Dense canopy, varied starlight |
| 50–99 | Old Growth | Deep greens, warm starlight |
| 100+ | Ancient Forest | Richest palette, brightest sky |

Trees are never deleted. The forest only grows.

---

## Tree Species

Fourteen species are randomly assigned when a tree is planted:

| Species | Region | Look |
|---------|--------|------|
| Oak | Europe | Round dense canopy |
| Pine | Northern forests | Tall, layered triangles |
| Birch | Northern Europe | Light trunk, bright leaves |
| Willow | Temperate zones | Drooping wide canopy |
| Cherry | East Asia | Pink bloom clusters |
| Maple | North America | Autumn red and orange |
| Ginkgo | East Asia | Golden fan-shaped crown |
| Acacia | East Africa | Flat-topped, tall trunk |
| Baobab | Madagascar / Africa | Massive trunk, sparse crown |
| Dragon Blood | Socotra | Umbrella-shaped dome |
| Araucaria | South America | Layered triangular tiers |
| Olive | Mediterranean | Silver-green rounded canopy |
| Banyan | South Asia | Wide canopy with aerial roots |
| Eucalyptus | Australia | Tall, blue-green tapered |

Each species has 4 growth stages (seed, sapling, young, full). Existing trees grow a little with each new prompt.

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `niwaki init` | Create forest and register Claude Code hook |
| `niwaki` | Launch the live viewer |
| `niwaki plant` | Plant a tree manually (normally runs via hook) |
| `niwaki badge` | Generate `niwaki-badge.svg` in current directory |
| `niwaki md` | Generate `FOREST.md` in current directory |

---

## Viewer

The viewer adapts to your terminal width — expand your terminal and new trees will spread across the full width. Press `Ctrl+C` to exit.

### Stats Bar

```
 niwaki · 42 trees · 7-day streak · ████████░░░░ next: oak [woodland]
 add your forest to your README → niwaki badge
```

| Segment | What it tells you |
|---------|-------------------|
| `42 trees` | Total trees — one per prompt, never deleted |
| `7-day streak` | Consecutive days you've used Claude Code |
| `wilting (2d idle)` | Shown instead of streak when inactive |
| `████████░░░░` | Progress toward next milestone (10, 25, 50, 100, 250, 500, 1000) |
| `next: oak` | Next species in the rotation cycle (14-species loop) |
| `[woodland]` | Current biome |

---

## Links

- **npm**: [npmjs.com/package/niwaki](https://www.npmjs.com/package/niwaki)
- **GitHub**: [github.com/theanhgen/niwaki](https://github.com/theanhgen/niwaki)
- **Issues**: [github.com/theanhgen/niwaki/issues](https://github.com/theanhgen/niwaki/issues)

## License

MIT
