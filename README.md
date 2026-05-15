# niwaki

[![npm version](https://img.shields.io/npm/v/niwaki.svg)](https://www.npmjs.com/package/niwaki)
[![license](https://img.shields.io/npm/l/niwaki.svg)](https://github.com/theanhgen/niwaki/blob/main/LICENSE)

Grow a living forest in your terminal every time you use Claude Code.

Each prompt plants a new tree. Each tree grows over time. Your forest evolves from a quiet clearing into an ancient woodland — complete with wildlife, weather, seasons, and a stream — and it never resets.

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

## The Living Ecosystem

The viewer simulates a full woodland ecosystem that changes with the time of day, season, and weather. Everything below happens automatically as your forest grows.

### Time of Day

The sky cycles through night → dawn → day → dusk in real time, using your system clock.

| Period | What you see |
|--------|-------------|
| Night | Stars, moon (phased), fireflies, bats, owl |
| Dawn | Warm horizon glow, dawn chorus notes, mist rising off the stream, spiderwebs |
| Day | Sun arc, birds, butterflies, bees |
| Dusk | Orange-red rays, bats emerging, stars fading in |

### Seasons

Four seasons drive which plants bloom, which animals appear, and what color the canopy turns.

| Season | Months | Highlights |
|--------|--------|-----------|
| Spring | Mar–May | Bluebells carpet, wood anemone, catkins, frog spawn, swallows arrive, dawn chorus |
| Summer | Jun–Aug | Full canopy, dragonflies, butterflies, elderflower, mayfly hatch, otters, bracken |
| Autumn | Sep–Nov | Species-specific canopy color, fieldfares, waxwings, jay burying acorns, fungi, leaf litter |
| Winter | Dec–Feb | Snow, icicles, frost, aurora borealis, holly berries, mistletoe, raven, bullfinch |

### Weather

| Event | Effect |
|-------|--------|
| Rain | Clouds darken, rain splashes on stream, puddles form, earthworm casts appear, mushrooms after |
| Thunderstorm | Lightning bolt + sky flash, lightning scars on trees, may strike and damage a tree |
| Heat shimmer | Summer midday — ground characters wobble in the heat |
| Morning mist | Pale wisps above the stream at dawn |
| Ground fog | Drifting low fog across the forest floor |
| Frost | Ice crystals form on branches; ground goes pale |
| Snow | White blanket on ground, pine cone litter, winter icicles |
| Rainbow | Arcs in upper sky after rain clears |
| Aurora borealis | Green/teal/purple curtains on winter nights |
| Meteor shower | Streaks of shooting stars across the sky |
| Comet | Rare slow arc through the night sky |
| Pollen drift | Spring — hazy yellow specks drifting through the canopy |

### The Stream

A deterministic stream meanders through the lower portion of the forest once it reaches Grove biome. It brings its own ecosystem:

- Stream fish dart through the current; salmon turn red in autumn
- Otters swim and dive
- Heron stands motionless at the edge, fishing
- Kingfisher dives from an overhanging branch
- Dipper bobs on rocks, walks underwater for invertebrates
- Damselfly and dragonfly dart over the surface in summer
- Water striders walk on the surface
- Mayflies hatch in spring clouds above the water
- Frog spawn clusters in still shallows (Feb–Mar)
- Newt appears during spring breeding season
- Reed mace (bulrush), rushes, and water crowfoot grow at the banks
- Purple loosestrife spikes in late summer beside the stream
- Morning mist rises off the water at dawn
- Flooding during heavy or post-rain events
- Beaver dam built across the stream in mature forest (40+ trees)
- Stream ice in winter; ice crystals form across the surface

### Wildlife

**Birds**

| Creature | When | Behaviour |
|----------|------|-----------|
| Robin | Year-round | Red-orange dot on stumps and low branches |
| Wood pigeon | Year-round | Plump grey perch in upper canopy |
| Wren | Year-round | Tiny `ω` in undergrowth, cocked tail when paused |
| Crows | Autumn/winter | Ground scavengers, walk and peck |
| Jay | Autumn | Hops along undergrowth, buries acorns |
| Raven | Winter | Soars high; large `\V/` wingspan |
| Buzzard | Year-round | Circles slowly on thermals |
| Hawk | Day | Solitary soaring at high altitude |
| Red kite | Day | Chestnut-red forked tail; lazy thermal soarer |
| Sparrowhawk | Day | Explosive low dash through the canopy |
| Peregrine | Day | Stoops vertically — fastest bird alive |
| Kestrel | Day | Hovers stationary with fanned tail `⊢` |
| Owl | Night | Perched silently in upper canopy |
| Barn owl | Night | Ghostly pale wing gliding at canopy level |
| Heron | Day | `T` silhouette standing motionless at stream |
| Kingfisher | Day | Dives from branch into stream |
| Dipper | Day | Bobs on stream rocks; walks underwater |
| Swallows | Spring/summer | Fast forked-tail `>` aerial hunters |
| Swift | Summer | High-speed dashes through upper sky |
| Fieldfares/Redwings | Winter | Russet-grey flock in direct flight |
| Waxwings | Winter | Crested flock with red/yellow wingtips at canopy top |
| Bullfinch | Winter | Male's rose-red breast in berry hedges |
| Goldfinch | Year-round | `◈` paused on seed head, `>` when flying |
| Starling murmuration | Autumn/winter dusk | Undulating blob shape shifting in sky |
| Bird migration | Spring/autumn | V-formation crossing the sky |
| Long-tailed tit flock | Winter | Small dots bouncing through canopy edge |
| Dawn chorus | Spring dawn | Musical `♩` notes rising from canopy |
| Cuckoo | Spring | Hidden call notes from deep canopy |

**Ground & Canopy Animals**

| Creature | When | Behaviour |
|----------|------|-----------|
| Fox | Dawn/night | Runs along undergrowth; fox earth entrance + spring cubs |
| Deer | Year-round | Grazes at undergrowth; autumn rut shows `Ψ` antlers; spring fawn follows |
| Rabbit | Dawn | Fast sprinter along undergrowth row |
| Hare | Year-round | Sits bolt upright when alarmed; bolts; paler winter coat |
| Squirrel | Year-round | Hops through canopy; winter drey (leaf nest) visible |
| Badger | Night | Lumbers across the forest floor |
| Hedgehog | Night | `ʘ` snuffling; rolls into a `●` ball when alarmed |
| Vole | Year-round | Tiny fast `›` prey scurrying across ground |
| Weasel | Year-round | Fastest ground animal; turns ermine-white in winter |
| Pine marten | Rare | Dark brown flash in lower canopy |
| Snake/Adder | Spring/summer | Basks in sun; coiled `⊂⊃` or moving `~` |
| Frog | Post-rain | Green dot near stream after rainfall |
| Toad migration | Spring evening | Parade of `o` toads crossing the ground |
| Salamander | Post-rain spring/summer | Orange-red body emerging from leaf litter |
| Bumblebee | Spring/summer | Fat yellow-black hoverer near flowers |
| Butterfly | Spring/summer days | Flutters through the understory |
| Moth | Summer nights | Pale specks drawn toward moonlight |
| Fireflies | Summer nights | Blinking in the lower understory |
| Caterpillar | Spring/summer | Creeps along ground with segmented body |
| Snail | Post-rain | Slow `@` crossing the undergrowth |
| Slug | Post-rain | Leaves a slime trail on the ground floor |
| Raccoon | Night | Nocturnal stream visitor; washes food with `◉` |

### Plants & Undergrowth

**Seasonal flowers**

| Plant | Season | Location |
|-------|--------|----------|
| Bluebell | Spring (Apr–May) | Violet-blue carpet across woodland floor |
| Wood anemone | Early spring (Mar) | Pale star flowers under canopy |
| Primrose | Late winter/spring (Feb–Apr) | Pale yellow clusters before bluebells |
| Catkins | Early spring | Dangling from birch and willow |
| Elderflower | Spring/summer (May–Jul) | Flat white flower heads on elder shrubs |
| Dog rose | Summer | Pink blooms in hedgerow patches |
| Purple loosestrife | Late summer (Jul–Sep) | Tall vivid violet spikes beside the stream |
| Bracken fern | Summer/autumn | Distinctive fronds in undergrowth |
| Wildflowers | Spring/summer | Scattered colour in undergrowth: poppy, cornflower, buttercup, clover, dandelion, daisy |
| Deep shade ferns | Spring–autumn | Under dense canopy in damp conditions |
| Ivy berries | Winter | Small black berries on ivy-covered trees |
| Rose hips | Autumn/winter | Red berries near forest edges |
| Old man's beard | Autumn/winter | Wispy Clematis trailing on shrub edges |
| Mistletoe | Winter | Spherical parasite in oak and hawthorn canopy |
| Holly shrub | Winter | Spiky evergreen with red berries in undergrowth |
| Nettle bed | Spring/summer | Dense green patches in disturbed open areas |
| Reed mace / bulrush | Summer/autumn | Brown seed heads at stream margins |
| Water crowfoot | Summer | White floating flowers on stream surface |

**Fungi & forest floor**

| Feature | When | Notes |
|---------|------|-------|
| Fly agaric | Autumn | Iconic red cap with white dots under birch/pine |
| Bracket fungi | Autumn/winter | Shelf fungus on ancient tree trunks |
| Trunk shelf fungi | Year-round | On very old trees (growth ≥ 0.95) |
| Fairy ring | After 3+ rain events | Permanent mushroom circle on ground |
| Post-rain mushrooms | After rain | Various earthy caps on the forest floor |
| Puffball mushrooms | Autumn | Round white spheres, burst black when ripe |
| Mushroom spore cloud | Summer/autumn after rain | Puff of spores rising from ground clusters |
| Blight / fungal outbreak | Rare | Infected canopy patches, spreading spores |

**Persistent features**

| Feature | Unlocks at |
|---------|-----------|
| Fallen log (moss-covered) | 20+ trees |
| Beaver dam | 40+ trees |
| Bat roost in hollow tree | Ancient trees |
| Squirrel drey | Winter, oak/ash/beech |
| Fox earth entrance | Mature forest |
| Woodpecker nest cavity | Old large trees |
| Ancient tree gnarling | Very old trees |
| Dormouse | Hibernating under log in winter |

### Forest Events

Rare events can alter the forest permanently:

| Event | Trigger | Effect |
|-------|---------|--------|
| Lightning strike | ~2% chance per prompt (5+ trees) | Damages a mature tree, reduces its growth |
| Tree fall | ~3% chance per prompt (10+ trees) | Converts a full-grown tree into a stump |
| Species mutation | ~1% chance per prompt | A tree spontaneously changes species |
| Wildfire | Rare | Spreads across the scene, scorches canopy |
| Blowdown | Post-storm | Storm throws over trees, leaving fallen trunks |
| Drought | Rare summer | Canopy wilts, ground cracks |
| Blight | Rare | Fungal outbreak spreads through canopy |

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
