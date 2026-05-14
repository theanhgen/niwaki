# Niwaki

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

That's it. Three commands:

1. **Install** the CLI globally
2. **Init** creates your forest file and registers a Claude Code hook
3. **Run the viewer** in a separate terminal to watch your forest grow

After setup, trees are planted automatically after every Claude Code response. No manual steps needed.

---

## How It Works

When you run `niwaki init`, it does two things:

- Creates `~/.niwaki/forest.json` to store your forest state
- Adds a `Stop` hook to `~/.claude/settings.json` that runs after every Claude Code response

From then on, every time Claude Code responds to a prompt, a new tree is planted in your forest automatically. Open the viewer in a second terminal to watch them grow in real time.

---

## Streaks

Niwaki tracks your coding streak — consecutive days where you use Claude Code.

- **Active streak**: The viewer and badge show your current streak count (e.g. `7-day streak`)
- **Broken streak**: Miss a day and your forest starts **wilting** — trees desaturate toward brown, and fog rolls in across the scene
- **Recovery**: Your next prompt resets the streak to 1 and clears the wilting immediately

The longer you go without coding, the worse it gets:

| Days idle | Effect |
|----------:|--------|
| 1 | Light desaturation, sparse fog |
| 2 | Noticeable browning, moderate fog |
| 3 | Heavy browning, dense fog |
| 4+ | Near-dead forest, thick fog |

Plant a tree to bring it all back to life.

---

## Badge

Generate a badge for your GitHub README that shows your forest stats and links back to [Niwaki](https://github.com/theanhgen/niwaki):

```bash
niwaki badge
```

This creates a `niwaki-badge.svg` file in your current directory and prints the markdown to embed it:

```markdown
[![niwaki](./niwaki-badge.svg)](https://github.com/theanhgen/niwaki)
```

The badge displays your tree count and streak status. It links to the [Niwaki repo](https://github.com/theanhgen/niwaki) so anyone who sees it can install it themselves.

| State | Badge color | Example |
|-------|-------------|---------|
| Active streak | Green | `42 trees · 7d streak` |
| Wilting | Orange-red | `42 trees · wilting` |
| No streak data | Grey | `42 trees` |

Re-run `niwaki badge` any time to update the SVG with your latest stats. Commit it to your repo to keep it current.

---

## FOREST.md

Generate a shareable markdown snapshot of your forest:

```bash
niwaki md
```

This creates a `FOREST.md` in your current directory with:

- Your Niwaki badge (links to the [Niwaki repo](https://github.com/theanhgen/niwaki))
- Stats: tree count, streak, biome
- A plain-text rendering of your forest (tree silhouettes, stars, ground)
- Total prompts and forest age

Commit `FOREST.md` to your repo root so your team can see the forest. When teammates see it, they can install Niwaki themselves — one install spreads to the whole team.

Run `niwaki badge` first to generate the SVG, then `niwaki md` to generate the markdown that embeds it.

---

## Biomes

Your forest evolves visually as it grows — the sky, ground, and atmosphere all change:

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

Fourteen species are randomly assigned when a tree is planted — a few highlights:

| Species | Look |
|---------|------|
| Pine | Tall, triangular shape |
| Birch | Light trunk, bright leaves |
| Willow | Drooping canopy |
| Maple | Autumn red and orange canopy |
| Baobab | Massive trunk, sparse crown |

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

The viewer adapts to your terminal width — expand your terminal and new trees will spread across the full width.

Press `Ctrl+C` to exit. The viewer shows a summary of your forest when you close it.

### Reading the Stats Bar

Below your forest you'll see a stats bar like this:

```
 niwaki · 42 trees · 7-day streak · ████████░░░░ next: oak [woodland]
```

Here's what each part means:

| Segment | What it tells you |
|---------|-------------------|
| `42 trees` | Total trees in your forest — one planted per prompt, never deleted |
| `7-day streak` | Consecutive days you've used Claude Code. Resets to 1 if you skip a day |
| `wilting (2d idle)` | Appears instead of streak when you've been inactive — your forest is dying |
| `████████░░░░` | Progress bar toward the next milestone (10, 25, 50, 100, 250, 500, 1000 trees) |
| `next: oak` | The species of the next tree that will be planted |
| `[woodland]` | Your current biome — evolves as your tree count grows |

---

## Links

- **bun**: [npmjs.com/package/niwaki](https://www.npmjs.com/package/niwaki)
- **GitHub**: [github.com/theanhgen/niwaki](https://github.com/theanhgen/niwaki)
- **Issues**: [github.com/theanhgen/niwaki/issues](https://github.com/theanhgen/niwaki/issues)

## License

MIT
