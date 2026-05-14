import chalk from "chalk"

import type { Forest, Grid, Sprite } from "./types.js"
import { getSprite, getAnimalSprite, TREE_TYPES } from "./sprites.js"

const SKY_ROWS = 4
const TREE_ROWS = 7
const GROUND_ROWS = 2
const SPACER_ROWS = 1
const STATS_ROWS = 1
const CTA_ROWS = 1

export const SCENE_HEIGHT =
  SKY_ROWS + TREE_ROWS + GROUND_ROWS + SPACER_ROWS + STATS_ROWS + CTA_ROWS

const STATS_ACCENT = "#f5a50b"
const STATS_TEXT = "#8e8a84"
const STATS_WARN = "#c4653a"
const STREAK_COLOR = "#e8a33a"
const BAR_FILL = "#6cb95e"
const BAR_EMPTY = "#3d3d3d"
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000]

const WILT_TARGET = { r: 0x8a, g: 0x6a, b: 0x4a }

interface RGB { r: number; g: number; b: number }

function parseHex(hex: string): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseHex(a), cb = parseHex(b)
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  })
}

function wiltColor(hex: string, factor: number): string {
  if (factor <= 0) return hex
  const c = parseHex(hex)
  return toHex({
    r: c.r + (WILT_TARGET.r - c.r) * factor,
    g: c.g + (WILT_TARGET.g - c.g) * factor,
    b: c.b + (WILT_TARGET.b - c.b) * factor,
  })
}

export function getWiltFactor(lastActiveDate: string | undefined): number {
  if (!lastActiveDate) return 0
  const today = new Date().toISOString().slice(0, 10)
  const a = new Date(lastActiveDate + "T00:00:00")
  const b = new Date(today + "T00:00:00")
  const days = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 0
  if (days === 1) return 0.25
  if (days === 2) return 0.45
  if (days === 3) return 0.65
  return Math.min(0.85, 0.65 + (days - 3) * 0.05)
}

const FOG_CHARS = ["░", "░", "▒"]
const FOG_COLOR_UPPER = "#9a9a9a"
const FOG_COLOR_LOWER = "#6a6a6a"

function applyFog(buffer: Grid, wilt: number, width: number): void {
  if (wilt <= 0) return
  const threshold = Math.max(3, Math.round(18 * (1 - wilt)))
  const fogStart = SKY_ROWS - 2
  const fogEnd = SKY_ROWS + TREE_ROWS + GROUND_ROWS

  for (let y = Math.max(0, fogStart); y < fogEnd; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const h = hash(x * 31 + y * 97 + 12345)
      if (h % threshold !== 0) continue
      const fogChar = FOG_CHARS[h % FOG_CHARS.length]!
      const blend = (y - fogStart) / (fogEnd - fogStart)
      const fogColor = blend > 0.5 ? FOG_COLOR_LOWER : FOG_COLOR_UPPER
      buffer[y]![x] = { char: fogChar, color: fogColor }
    }
  }
}

interface Biome {
  ground: [string, string]
  starGlyphs: string[]
  starDensity: number
  starColors: string[]
  label: string
}

const BIOMES: Biome[] = [
  {
    ground: ["#2a3a28", "#1e2d1c"],
    starGlyphs: ["·", ".", " ", " "],
    starDensity: 12,
    starColors: ["#3a3a3a", "#444444"],
    label: "clearing",
  },
  {
    ground: ["#22492d", "#18361f"],
    starGlyphs: ["·", "·", "✦", "."],
    starDensity: 9,
    starColors: ["#444444", "#5d5d5d"],
    label: "grove",
  },
  {
    ground: ["#1e4a28", "#163a1e"],
    starGlyphs: ["·", "✦", "✧", "·", "."],
    starDensity: 7,
    starColors: ["#4d4d4d", "#5d5d5d", "#6a6a55"],
    label: "woodland",
  },
  {
    ground: ["#1a5230", "#124020"],
    starGlyphs: ["✦", "✧", "·", "·", "✦", "."],
    starDensity: 6,
    starColors: ["#5d5d5d", "#6d6d5a", "#7a7a60"],
    label: "old growth",
  },
  {
    ground: ["#165a32", "#0e4822"],
    starGlyphs: ["✦", "✧", "·", "✦", "⋆", "."],
    starDensity: 5,
    starColors: ["#6d6d5a", "#7a7a60", "#8a8a6a"],
    label: "ancient forest",
  },
]

function getBiome(treeCount: number): Biome {
  if (treeCount < 10) return BIOMES[0]!
  if (treeCount < 25) return BIOMES[1]!
  if (treeCount < 50) return BIOMES[2]!
  if (treeCount < 100) return BIOMES[3]!
  return BIOMES[4]!
}

function createBuffer(width: number): Grid {
  return Array.from({ length: SCENE_HEIGHT }, () =>
    Array.from({ length: width }, () => ({ char: " ", color: null })),
  )
}

function hash(seed: number): number {
  let value = seed >>> 0
  value = Math.imul((value >>> 16) ^ value, 0x45d9f3b) >>> 0
  value = Math.imul((value >>> 16) ^ value, 0x45d9f3b) >>> 0
  return ((value >>> 16) ^ value) >>> 0
}

interface Star { x: number; y: number; char: string; color: string }

function generateStars(width: number, biome: Biome, twinkle = 0): Star[] {
  const stars: Star[] = []
  for (let x = 0; x < width; x += 1) {
    const seeded = hash(x + width * 17 + twinkle * 101)
    if (seeded % biome.starDensity !== 0) continue
    stars.push({
      x,
      y: seeded % SKY_ROWS,
      char: biome.starGlyphs[seeded % biome.starGlyphs.length]!,
      color: biome.starColors[seeded % biome.starColors.length]!,
    })
  }
  return stars
}

function compositeSprite(buffer: Grid, sprite: Sprite, centerX: number, baseY: number): void {
  const offsetX = centerX - Math.floor(sprite.width / 2)
  for (let rowIndex = 0; rowIndex < sprite.rows.length; rowIndex += 1) {
    const targetY = baseY - rowIndex
    if (targetY < 0 || targetY >= buffer.length) continue
    const row = sprite.rows[rowIndex]!
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const targetX = offsetX + columnIndex
      if (targetX < 0 || targetX >= buffer[0]!.length) continue
      const [char, color] = row[columnIndex]!
      if (!color) continue
      buffer[targetY]![targetX] = { char, color }
    }
  }
}

function getNextMilestone(treeCount: number): number {
  return MILESTONES.find((value) => treeCount < value) ?? treeCount + 100
}

function getNextTreeType(treeCount: number): string {
  return TREE_TYPES[treeCount % TREE_TYPES.length]!
}

const STATS_SHORT: Record<string, string> = {
  dragonblood: "dragon",
  eucalyptus: "eucalypt",
  araucaria: "araucar",
}

function getNextTreeDisplay(treeCount: number): string {
  const type = getNextTreeType(treeCount)
  return STATS_SHORT[type] ?? type
}

function buildStreakSegment(forest: Forest): string {
  const wilt = getWiltFactor(forest.lastActiveDate)
  const streak = forest.streak ?? 0

  if (wilt > 0) {
    const a = new Date((forest.lastActiveDate ?? "") + "T00:00:00")
    const b = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")
    const idle = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
    return chalk.hex(STATS_WARN)(`wilting (${idle}d idle)`)
  }

  if (streak <= 0) return chalk.hex(STATS_TEXT)("no streak")
  return chalk.hex(STREAK_COLOR)(`${streak}-day streak`)
}

function buildStatsLine(forest: Forest, biome: Biome): string {
  const treeCount = forest.trees.length
  const milestone = getNextMilestone(treeCount)
  const progress = milestone === 0 ? 0 : treeCount / milestone
  const barWidth = 12
  const filledWidth = Math.max(0, Math.min(barWidth, Math.round(progress * barWidth)))
  const bar =
    chalk.hex(BAR_FILL)("█".repeat(filledWidth)) +
    chalk.hex(BAR_EMPTY)("░".repeat(barWidth - filledWidth))

  return (
    chalk.hex(STATS_ACCENT)(" niwaki") +
    chalk.hex(STATS_TEXT)(
      ` · ${treeCount} tree${treeCount === 1 ? "" : "s"} · `,
    ) +
    buildStreakSegment(forest) +
    chalk.hex(STATS_TEXT)(" · ") +
    bar +
    chalk.hex(STATS_TEXT)(` next: ${getNextTreeDisplay(treeCount)}`) +
    chalk.hex("#555555")(` [${biome.label}]`)
  )
}

// ── Time of day ──────────────────────────────────────────────────────────────

type TimePeriod = "night" | "dawn" | "day" | "dusk"

function getTimeOfDay(date: Date): { period: TimePeriod; blend: number } {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 5 && h < 7) return { period: "dawn", blend: (h - 5) / 2 }
  if (h >= 7 && h < 18) return { period: "day", blend: 0 }
  if (h >= 18 && h < 22) return { period: "dusk", blend: (h - 18) / 4 }
  return { period: "night", blend: 0 }
}

function getSkyColor(row: number, period: TimePeriod, blend: number): string {
  // row 0 = top/zenith, row SKY_ROWS-1 = horizon
  const t = row / (SKY_ROWS - 1)
  if (period === "night") {
    return lerpColor("#06080f", "#0d1220", t)
  }
  if (period === "day") {
    return lerpColor("#1a3a6a", "#2a4a7a", t)
  }
  if (period === "dawn") {
    const zenith = lerpColor("#06080f", "#1a0a2e", blend)
    const horizon = lerpColor("#0d1220", "#7a3020", blend)
    return lerpColor(zenith, horizon, t)
  }
  // dusk
  const zenith = lerpColor("#1a3a6a", "#2a0a3a", blend)
  const horizon = lerpColor("#2a4a7a", "#6a1a10", blend)
  return lerpColor(zenith, horizon, t)
}

// ── Sun arc ──────────────────────────────────────────────────────────────────

function getSunPosition(date: Date, width: number): { x: number; y: number; color: string } | null {
  const h = date.getHours() + date.getMinutes() / 60
  if (h < 7 || h > 18) return null
  const t = (h - 7) / 11  // 0 at sunrise, 1 at sunset
  const x = Math.floor(t * (width - 2)) + 1
  const arc = 1 - 4 * (t - 0.5) ** 2  // parabola: 0 at edges, 1 at noon
  const y = Math.round((SKY_ROWS - 1) * (1 - arc * 0.85))
  const proximity = Math.abs(t - 0.5)
  const color = proximity > 0.38 ? "#e07818" : proximity > 0.22 ? "#f0b030" : "#f8e050"
  return { x, y, color }
}

// ── Moon phase ───────────────────────────────────────────────────────────────

function getMoonPhase(date: Date): number {
  // Returns 0-1, 0=new moon, 0.5=full moon
  const knownNew = new Date("2000-01-06T00:00:00Z").getTime()
  const lunarMs = 29.530589 * 24 * 60 * 60 * 1000
  return ((date.getTime() - knownNew) % lunarMs) / lunarMs
}

function getMoonChar(phase: number): string {
  if (phase < 0.05 || phase > 0.95) return "·"
  if (phase < 0.25) return "◔"
  if (phase < 0.45) return "◑"
  if (phase < 0.55) return "●"
  if (phase < 0.75) return "◑"
  if (phase < 0.95) return "◔"
  return "·"
}

// ── Seasons ──────────────────────────────────────────────────────────────────

function getSeason(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month >= 2 && month <= 4) return "spring"
  if (month >= 5 && month <= 7) return "summer"
  if (month >= 8 && month <= 10) return "autumn"
  return "winter"
}

const SEASON_TINTS: Record<string, { target: RGB; factor: number }> = {
  spring: { target: { r: 0x6a, g: 0xd4, b: 0x6a }, factor: 0.08 },
  summer: { target: { r: 0x00, g: 0x00, b: 0x00 }, factor: 0 },
  autumn: { target: { r: 0xcc, g: 0x88, b: 0x33 }, factor: 0.10 },
  winter: { target: { r: 0x88, g: 0x99, b: 0xcc }, factor: 0.08 },
}

function seasonTintColor(hex: string, season: string): string {
  const tint = SEASON_TINTS[season]
  if (!tint || tint.factor === 0) return hex
  const c = parseHex(hex)
  return toHex({
    r: c.r + (tint.target.r - c.r) * tint.factor,
    g: c.g + (tint.target.g - c.g) * tint.factor,
    b: c.b + (tint.target.b - c.b) * tint.factor,
  })
}

// ── renderFrame ──────────────────────────────────────────────────────────────

export function renderFrame(
  forest: Forest,
  termWidth = 80,
  options: { twinkleSeed?: number; birds?: { x: number; y: number }[]; foxes?: { x: number }[]; shootingStarTrail?: { x: number; y: number }[]; deer?: { x: number }; milestoneText?: string; isRaining?: boolean; windStrength?: 0 | 1 | 2; postRain?: boolean; isLightning?: boolean } = {},
): string {
  const width = Math.max(40, termWidth)
  const buffer = createBuffer(width)
  const groundStart = SKY_ROWS + TREE_ROWS
  const biome = getBiome(forest.trees.length)
  const wilt = getWiltFactor(forest.lastActiveDate)
  const effectiveWilt = options.isRaining ? wilt * 0.3 : wilt

  // 1. Time of day + season
  const now = new Date()
  const { period, blend } = getTimeOfDay(now)
  const season = getSeason(now.getMonth())

  // 2. Fill sky gradient
  for (let y = 0; y < SKY_ROWS; y++) {
    const skyColor = getSkyColor(y, period, blend)
    for (let x = 0; x < width; x++) {
      buffer[y]![x] = { char: "█", color: skyColor }
    }
  }

  // 2b. Sun arc (day only, hidden during rain)
  if (!options.isRaining) {
    const sun = getSunPosition(now, width)
    if (sun) {
      buffer[sun.y]![sun.x] = { char: "●", color: sun.color }
      const glowColor = lerpColor(sun.color, getSkyColor(sun.y, period, blend), 0.55)
      if (sun.x + 1 < width) buffer[sun.y]![sun.x + 1] = { char: "·", color: glowColor }
      if (sun.x - 1 >= 0) buffer[sun.y]![sun.x - 1] = { char: "·", color: glowColor }
    }
  }

  // 2c. Shooting star trail
  for (const p of options.shootingStarTrail ?? []) {
    if (p.y >= 0 && p.y < SKY_ROWS && p.x >= 0 && p.x < width) {
      const brightness = p.y === 0 ? "#ffffff" : p.y === 1 ? "#ddddc8" : "#888870"
      buffer[p.y]![p.x] = { char: p.y < 2 ? "·" : ".", color: brightness }
    }
  }

  // 3. Place stars (dimmed during day)
  for (const star of generateStars(width, biome, options.twinkleSeed ?? 0)) {
    let starColor = star.color
    if (period === "day") {
      starColor = lerpColor(starColor, getSkyColor(star.y, period, blend), 0.7)
    }
    buffer[star.y]![star.x] = { char: star.char, color: starColor }
  }

  // 4. Moon
  const moonPhase = getMoonPhase(now)
  const moonBrightness = Math.sin(moonPhase * Math.PI)
  const moonColor = lerpColor("#555550", "#ddd8c8", moonBrightness)
  const moonChar = getMoonChar(moonPhase)
  const moonX = Math.floor(width * 0.72)
  const moonY = 1
  if (moonX >= 0 && moonX < width) {
    buffer[moonY]![moonX] = { char: moonChar, color: moonColor }
  }

  // 5. Ground fill
  for (let rowIndex = 0; rowIndex < GROUND_ROWS; rowIndex += 1) {
    for (let x = 0; x < width; x += 1) {
      buffer[groundStart + rowIndex]![x] = {
        char: "█",
        color: biome.ground[rowIndex]!,
      }
    }
  }

  // Winter snow on top ground row
  if (season === "winter") {
    for (let x = 0; x < width; x++) {
      const snowChar = hash(x * 13 + 77) % 3 === 0 ? "░" : "█"
      buffer[groundStart]![x] = { char: snowChar, color: lerpColor(biome.ground[0]!, "#c8d0d8", 0.6) }
    }
  }

  // 6. Composite trees
  const treeBaseY = groundStart - 1
  for (const tree of forest.trees) {
    compositeSprite(buffer, getSprite(tree.type, tree.growth, tree.id % 3), tree.x, treeBaseY)
  }

  // 6b. Composite animal visitors
  for (const tree of forest.trees) {
    if (!tree.visitor) continue
    const treeSprite = getSprite(tree.type, tree.growth, tree.id % 3)
    const sideOffset = Math.floor(treeSprite.width / 2) + 2
    try {
      compositeSprite(buffer, getAnimalSprite(tree.visitor), tree.x + sideOffset, treeBaseY)
    } catch {}
  }

  // 6c. Owl — perches at top of a tree at night, gone by mid-dawn
  if ((period === "night" || (period === "dusk" && blend > 0.6) || (period === "dawn" && blend < 0.3)) && forest.trees.length > 0) {
    const roostIdx = hash(forest.trees.length * 13 + 42) % forest.trees.length
    const roostX = forest.trees[roostIdx]!.x
    for (let y = SKY_ROWS; y < SKY_ROWS + TREE_ROWS - 1; y++) {
      if (buffer[y]![roostX]?.color !== null) {
        const owlY = Math.max(SKY_ROWS, y - 1)
        if (buffer[owlY]![roostX]?.color === null) {
          buffer[owlY]![roostX] = { char: "ö", color: "#9a8a6a" }
        }
        break
      }
    }
  }

  // 7. Birds
  for (const bird of options.birds ?? []) {
    if (bird.y >= 0 && bird.y < SKY_ROWS && bird.x >= 0 && bird.x < width) {
      buffer[bird.y]![bird.x] = { char: ">", color: "#7a7878" }
    }
  }

  // 7b. Lightning bolt in sky
  if (options.isLightning) {
    const boltX = hash((options.twinkleSeed ?? 0) * 53 + 22222) % width
    for (let y = 0; y < SKY_ROWS; y++) {
      buffer[y]![boltX] = { char: y === SKY_ROWS - 1 ? "!" : "|", color: y === 0 ? "#ffffff" : "#ffffa0" }
    }
    if (boltX + 1 < width) buffer[0]![boltX + 1] = { char: "·", color: "#ffffcc" }
  }

  // 7c. Deer — grazes at undergrowth level at dawn/dusk
  if (options.deer) {
    const dy = groundStart - 1
    const dx = options.deer.x
    if (dx >= 1 && dx < width) {
      buffer[dy]![dx] = { char: "Y", color: "#9a7a50" }
      buffer[dy]![dx - 1] = { char: ":", color: "#8a6a40" }
    }
  }

  // 7d. Fox — runs along the undergrowth row
  for (const fox of options.foxes ?? []) {
    const fy = groundStart - 1
    if (fox.x >= 0 && fox.x < width) {
      buffer[fy]![fox.x] = { char: ">", color: "#d06020" }
      if (fox.x - 1 >= 0) buffer[fy]![fox.x - 1] = { char: "~", color: "#b84a10" }
    }
  }

  // 7d. Winter frost — ice crystals on tree branches
  if (season === "winter") {
    for (let y = SKY_ROWS; y < groundStart - 1; y++) {
      for (let x = 0; x < width; x++) {
        if (!buffer[y]![x]?.color) continue
        const h = hash(x * 43 + y * 89 + 5678)
        if (h % 22 !== 0) continue
        buffer[y]![x] = { char: "*", color: "#b0c8e8" }
      }
    }
  }

  // 8a. Undergrowth — sparse details between tree trunks
  const undergrowthY = groundStart - 1
  for (let x = 0; x < width; x++) {
    if (buffer[undergrowthY]![x]?.color !== null) continue
    const h = hash(x * 71 + forest.trees.length * 17 + 999)
    if (h % 5 !== 0) continue
    const variant = h % 6
    const parts = [
      { char: ",", color: "#4a7030" },
      { char: ".", color: "#5a4a30" },
      { char: "♣", color: "#3a6228" },
      { char: "·", color: "#6a5030" },
    ] as const
    if (variant < 4) buffer[undergrowthY]![x] = parts[variant]!
  }

  // Post-rain: puddles on ground + mushrooms in undergrowth
  if (options.postRain) {
    for (let x = 0; x < width; x++) {
      const h = hash(x * 59 + 8888)
      if (h % 7 === 0) {
        buffer[groundStart]![x] = { char: "~", color: "#3a6a8a" }
      }
      if (h % 11 === 0 && buffer[undergrowthY]![x]?.color === null) {
        const mushroomColors = ["#8a3a2a", "#c4521a", "#e8782a"] as const
        buffer[undergrowthY]![x] = { char: "♦", color: mushroomColors[h % 3]! }
      }
    }
  }

  // Autumn fallen leaves — more dense in wind
  if (season === "autumn") {
    const leafDensity = options.windStrength === 2 ? 5 : options.windStrength === 1 ? 7 : 9
    for (let x = 0; x < width; x++) {
      const h = hash(x * 83 + (options.twinkleSeed ?? 0) * 41 + 4444)
      if (h % leafDensity !== 0) continue
      const ly = SKY_ROWS + TREE_ROWS - 2 + (h % 2)
      if (buffer[ly]![x]?.color !== null) continue
      const leafColors = ["#c4701a", "#e8a020", "#d45010"] as const
      buffer[ly]![x] = { char: "·", color: leafColors[h % 3]! }
    }
  }

  // 8b. Spring pollen — golden dust drifting through mid-canopy
  if (season === "spring") {
    const seed = options.twinkleSeed ?? 0
    const pollenCount = Math.max(2, Math.floor(width * 0.04))
    for (let i = 0; i < pollenCount; i++) {
      const h = hash(i * 79 + seed * 61 + 6666)
      const x = h % width
      const y = SKY_ROWS + 2 + (hash(h + 11) % Math.floor(TREE_ROWS * 0.5))
      if (buffer[y]![x]?.color !== null) continue
      buffer[y]![x] = { char: ".", color: "#d4a820" }
    }
  }

  // 8c. Spring blossom drift — pink petals floating in upper canopy
  if (season === "spring") {
    const seed = options.twinkleSeed ?? 0
    const petalCount = Math.max(2, Math.floor(width * 0.05))
    for (let i = 0; i < petalCount; i++) {
      const h = hash(i * 61 + seed * 83 + 3333)
      const x = h % width
      const y = SKY_ROWS + (hash(h + 5) % Math.floor(TREE_ROWS * 0.6))
      if (buffer[y]![x]?.color !== null) continue
      const petalColors = ["#f0a0c0", "#e880a8", "#ffc0d8"] as const
      buffer[y]![x] = { char: "✿", color: petalColors[h % 3]! }
    }
  }

  // 8c. Fireflies — night and dusk only, drift with twinkle seed
  if (period === "night" || period === "dusk") {
    const seed = options.twinkleSeed ?? 0
    const count = Math.max(3, Math.floor(width * 0.06))
    for (let i = 0; i < count; i++) {
      const h = hash(i * 53 + seed * 97 + 1234)
      const x = h % width
      const y = SKY_ROWS + 1 + (hash(h + 7) % (TREE_ROWS - 2))
      if (buffer[y]![x]?.color !== null) continue
      const brightness = hash(h + 13) % 3
      const colors = ["#3a6218", "#88c830", "#c8e850"] as const
      const chars = ["·", "·", "✦"] as const
      buffer[y]![x] = { char: chars[brightness]!, color: colors[brightness]! }
    }
  }

  // 8c. Rain drops — angled by wind strength
  if (options.isRaining) {
    const seed = options.twinkleSeed ?? 0
    const wind = options.windStrength ?? 0
    const dropCount = Math.floor(width * 0.18)
    for (let i = 0; i < dropCount; i++) {
      const h = hash(i * 37 + seed * 113 + 5555)
      const x = h % width
      const y = hash(h + 3) % (SKY_ROWS + TREE_ROWS)
      const cell = buffer[y]![x]
      if (!cell) continue
      if (y >= SKY_ROWS && cell.color !== null && hash(h + 9) % 3 !== 0) continue
      const dropChar = wind === 2 ? "/" : wind === 1 && h % 2 === 0 ? "/" : "|"
      buffer[y]![x] = { char: dropChar, color: "#4a7a9a" }
    }
  }

  // 8d. Dawn mist — blue-grey overlay at dawn, distinct from wilt
  if (period === "dawn" && blend < 0.7) {
    const mistDensity = Math.max(4, Math.round(12 * blend + 4))
    const mistStart = SKY_ROWS + Math.floor(TREE_ROWS * 0.4)
    for (let y = mistStart; y < groundStart + GROUND_ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const h = hash(x * 29 + y * 67 + 77777)
        if (h % mistDensity !== 0) continue
        const mistChar = h % 3 === 0 ? "▒" : "░"
        buffer[y]![x] = { char: mistChar, color: "#7a8fa8" }
      }
    }
  }

  // 8e. Fog (wilt)
  applyFog(buffer, effectiveWilt, width)

  // 9. Output loop with season + wilt color composition
  const lines: string[] = []
  for (let y = 0; y < SCENE_HEIGHT - SPACER_ROWS - STATS_ROWS - CTA_ROWS; y += 1) {
    let line = ""
    for (const cell of buffer[y]!) {
      if (!cell.color) {
        line += cell.char
      } else {
        let color = seasonTintColor(cell.color, season)
        if (effectiveWilt > 0 && y >= SKY_ROWS) color = wiltColor(color, effectiveWilt)
        line += chalk.hex(color)(cell.char)
      }
    }
    lines.push(line)
  }

  // 10. Stats + CTA
  lines.push("")
  lines.push(
    options.milestoneText
      ? chalk.hex(STATS_ACCENT)(options.milestoneText.padStart(
          Math.floor((width + options.milestoneText.length) / 2)
        ))
      : buildStatsLine(forest, biome)
  )
  lines.push(
    chalk.hex("#555555")(" add your forest to your README → ") +
    chalk.hex(STATS_ACCENT)("niwaki badge"),
  )

  return lines.join("\n")
}

// ── buildScene ───────────────────────────────────────────────────────────────

export function buildScene(forest: Forest, width: number): { buffer: Grid; biome: Biome; sceneRows: number } {
  const w = Math.max(40, width)
  const sceneRows = SKY_ROWS + TREE_ROWS + GROUND_ROWS
  const buffer: Grid = Array.from({ length: sceneRows }, () =>
    Array.from({ length: w }, () => ({ char: " ", color: null })),
  )
  const groundStart = SKY_ROWS + TREE_ROWS
  const biome = getBiome(forest.trees.length)
  const wilt = getWiltFactor(forest.lastActiveDate)

  // Time of day + season
  const now = new Date()
  const { period, blend } = getTimeOfDay(now)
  const season = getSeason(now.getMonth())

  // Fill sky gradient
  for (let y = 0; y < SKY_ROWS; y++) {
    const skyColor = getSkyColor(y, period, blend)
    for (let x = 0; x < w; x++) {
      buffer[y]![x] = { char: "█", color: skyColor }
    }
  }

  // Place stars (dimmed during day)
  for (const star of generateStars(w, biome, 0)) {
    if (star.y < sceneRows) {
      let starColor = star.color
      if (period === "day") {
        starColor = lerpColor(starColor, getSkyColor(star.y, period, blend), 0.7)
      }
      buffer[star.y]![star.x] = { char: star.char, color: starColor }
    }
  }

  // Ground fill
  for (let rowIndex = 0; rowIndex < GROUND_ROWS; rowIndex += 1) {
    for (let x = 0; x < w; x += 1) {
      buffer[groundStart + rowIndex]![x] = { char: "█", color: biome.ground[rowIndex]! }
    }
  }

  // Winter snow on top ground row
  if (season === "winter") {
    for (let x = 0; x < w; x++) {
      const snowChar = hash(x * 13 + 77) % 3 === 0 ? "░" : "█"
      buffer[groundStart]![x] = { char: snowChar, color: lerpColor(biome.ground[0]!, "#c8d0d8", 0.6) }
    }
  }

  // Composite trees
  const treeBaseY = groundStart - 1
  for (const tree of forest.trees) {
    compositeSprite(buffer, getSprite(tree.type, tree.growth, tree.id % 3), tree.x, treeBaseY)
  }

  applyFog(buffer, wilt, w)

  // Apply wilt to tree/ground cells (unconditional pass)
  for (let y = SKY_ROWS; y < sceneRows; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const cell = buffer[y]![x]!
      if (cell.color && wilt > 0) {
        cell.color = wiltColor(cell.color, wilt)
      }
    }
  }

  return { buffer, biome, sceneRows }
}

// ── renderPlainText ──────────────────────────────────────────────────────────

export function renderPlainText(forest: Forest, width = 60): string {
  const w = Math.max(40, Math.min(width, 80))
  const buffer = createBuffer(w)
  const groundStart = SKY_ROWS + TREE_ROWS
  const biome = getBiome(forest.trees.length)

  for (const star of generateStars(w, biome, 0)) {
    buffer[star.y]![star.x] = { char: star.char, color: star.color }
  }

  for (let rowIndex = 0; rowIndex < GROUND_ROWS; rowIndex += 1) {
    for (let x = 0; x < w; x += 1) {
      buffer[groundStart + rowIndex]![x] = { char: "█", color: "#333" }
    }
  }

  const treeBaseY = groundStart - 1
  for (const tree of forest.trees) {
    compositeSprite(buffer, getSprite(tree.type, tree.growth, tree.id % 3), tree.x, treeBaseY)
  }

  const lines: string[] = []
  for (let y = 0; y < SCENE_HEIGHT - SPACER_ROWS - STATS_ROWS - CTA_ROWS; y += 1) {
    let line = ""
    for (const cell of buffer[y]!) {
      line += cell.char
    }
    lines.push(line.trimEnd())
  }

  return lines.join("\n")
}
