import chalk from "chalk"

import type { Forest, Grid, Sprite } from "./types.js"
import { getSprite, getAnimalSprite, TREE_TYPES } from "./sprites.js"

export const SKY_ROWS = 7
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
    starColors: ["#6a7888", "#7a8898"],
    label: "clearing",
  },
  {
    ground: ["#22492d", "#18361f"],
    starGlyphs: ["·", "·", "✦", "."],
    starDensity: 9,
    starColors: ["#7888a8", "#8898b8", "#9098b0"],
    label: "grove",
  },
  {
    ground: ["#1e4a28", "#163a1e"],
    starGlyphs: ["·", "✦", "✧", "·", "."],
    starDensity: 7,
    starColors: ["#8898b0", "#a0b0c8", "#b0b8c8", "#a8a090"],
    label: "woodland",
  },
  {
    ground: ["#1a5230", "#124020"],
    starGlyphs: ["✦", "✧", "·", "·", "✦", "."],
    starDensity: 6,
    starColors: ["#98a8c0", "#b8c8d8", "#c8d0e0", "#c0b898"],
    label: "old growth",
  },
  {
    ground: ["#165a32", "#0e4822"],
    starGlyphs: ["✦", "✧", "·", "✦", "⋆", "."],
    starDensity: 5,
    starColors: ["#a0b0c8", "#c0d0e0", "#d8e4f4", "#e8eeff", "#d8d0b8"],
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
    return lerpColor("#2a6ab0", "#5898d0", t)
  }
  if (period === "dawn") {
    const zenith = lerpColor("#06080f", "#1a1060", blend)
    const horizon = lerpColor("#0d1220", "#904820", blend)
    return lerpColor(zenith, horizon, t)
  }
  // dusk
  const zenith = lerpColor("#2a6ab0", "#2a0a3a", blend)
  const horizon = lerpColor("#5898d0", "#8a2810", blend)
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
  if (phase < 0.04 || phase > 0.96) return ""           // new moon: invisible
  if (phase < 0.24) return "◑"                          // waxing crescent→quarter
  if (phase < 0.26) return "◑"                          // first quarter
  if (phase < 0.46) return "●"                          // waxing gibbous
  if (phase < 0.54) return "◉"                          // full moon
  if (phase < 0.74) return "●"                          // waning gibbous
  if (phase < 0.76) return "◐"                          // last quarter
  if (phase < 0.96) return "◐"                          // waning crescent→quarter
  return ""
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

// ── Cloud rendering ──────────────────────────────────────────────────────────

function cloudColor(density: 0 | 1 | 2, period: TimePeriod, blend: number): string {
  // base palette per density: [light, medium, heavy]
  const day   = ["#c8d4e0", "#8898a8", "#505e6e"] as const
  const night = ["#1e2630", "#141c24", "#0c1018"] as const
  const warm  = ["#e09868", "#b06030", "#783018"] as const  // golden-hour peak

  const d = density
  if (period === "night") return night[d]
  if (period === "day")   return day[d]
  // dawn/dusk: cycle through warm peak at blend ≈ 0.5
  const warmPeak = Math.sin(blend * Math.PI)
  const base = period === "dawn" ? lerpColor(night[d], day[d], blend) : lerpColor(day[d], night[d], blend)
  return lerpColor(base, warm[d], warmPeak * 0.75)
}

function drawCloud(
  buffer: Grid, cx: number, cy: number, cw: number,
  density: 0 | 1 | 2, period: TimePeriod, blend: number, width: number,
): void {
  const chars = ["░", "▒", "▓"] as const
  const baseChar = chars[density]
  const baseCol  = cloudColor(density, period, blend)
  const lightDensity = Math.max(0, density - 1) as 0 | 1 | 2
  const lightChar = chars[lightDensity]
  const lightCol  = cloudColor(lightDensity, period, blend)

  // base row — full width
  for (let i = 0; i < cw; i++) {
    const x = cx + i
    if (x >= 0 && x < width && cy >= 0 && cy < SKY_ROWS)
      buffer[cy]![x] = { char: baseChar, color: baseCol }
  }
  // upper row — lighter, 1 cell narrower each side
  if (cy - 1 >= 0 && cy - 1 < SKY_ROWS) {
    for (let i = 1; i < cw - 1; i++) {
      const x = cx + i
      if (x >= 0 && x < width)
        buffer[cy - 1]![x] = { char: lightChar, color: lightCol }
    }
  }
}

// ── renderFrame ──────────────────────────────────────────────────────────────

export function renderFrame(
  forest: Forest,
  termWidth = 80,
  options: { twinkleSeed?: number; birds?: { x: number; y: number }[]; foxes?: { x: number }[]; rabbits?: { x: number }[]; shootingStarTrail?: { x: number; y: number }[]; deer?: { x: number }; fairyRingX?: number; milestoneText?: string; isRaining?: boolean; windStrength?: 0 | 1 | 2; postRain?: boolean; isLightning?: boolean; comet?: { x: number; y: number }; bearPrints?: number[]; bats?: { x: number; y: number }[]; hawk?: { x: number }; squirrel?: { x: number }; heron?: { x: number }; dragonfly?: { x: number; y: number }; streamFish?: { x: number; leftward: boolean }; woodpecker?: { x: number; y: number; peck: boolean }; weasel?: { x: number; y: number }; frog?: { x: number }; fireflies?: { x: number; y: number; lit: boolean }[]; owl?: { x: number; y: number }; butterfly?: { x: number; y: number; color: string }; clouds?: { x: number; y: number; width: number; density: 0|1|2 }[]; crows?: { x: number; pecking: boolean }[]; wildfire?: { x: number; width: number; stage: string; seed: number }; beetles?: { zones: { x: number; radius: number }[]; intensity: number }; drought?: { intensity: number }; blowdown?: { seed: number; fallen: { x: number; dir: 1 | -1 }[] }; blight?: { zones: number[]; intensity: number; seed: number }; frost?: { intensity: number; seed: number }; lightningScars?: { x: number }[]; fallingLeaves?: { x: number; y: number; color: string; char: string }[]; groundMushrooms?: number[]; morningDew?: boolean; pollenDrift?: { x: number; y: number }[]; spiderWebs?: { x: number; span: number }[]; snail?: { x: number }; caterpillar?: { segments: number[]; dir: 1 | -1 }; otter?: { x: number; diving: boolean }; berries?: { x: number; color: string }[]; mossPatch?: boolean; seedDrift?: { x: number; y: number; char: string }[]; badger?: { x: number }; kingfisher?: { x: number; diving: boolean }; boar?: { x: number; rooting: boolean }; dawnChorus?: { x: number; y: number; life: number }[]; beetle?: { x: number }; puddles?: number[]; groundFog?: boolean; moth?: { x: number; y: number; color: string }; migration?: { x: number; y: number; size: number }; raccoon?: { x: number; washing: boolean }; moleHills?: number[]; murmuration?: { x: number; y: number; seed: number }; mayflyHatch?: boolean; vole?: { x: number }; kestrel?: { x: number; y: number }; hedgehog?: { x: number; rolled: boolean }; salamander?: { x: number }; jay?: { x: number; carrying: boolean; leftward: boolean }; aurora?: { intensity: number; phase: number }; buzzard?: { x: number; y: number }; wren?: { x: number }; pineMarten?: { x: number; y: number }; pheasant?: { x: number; flushed: boolean }; sparrowhawk?: { x: number; y: number; leftward: boolean }; titFlock?: { x: number; y: number }[]; goldfinch?: { x: number; paused: boolean }; barnOwl?: { x: number; y: number }; slug?: { x: number }; snake?: { x: number; basking: boolean }; toadMigration?: { x: number }[]; hare?: { x: number; frozen: boolean; leftward: boolean }; raven?: { x: number; y: number }; swallows?: { x: number; y: number }[]; redKite?: { x: number; y: number }; waxwings?: { x: number; y: number }[]; bullfinch?: { x: number }; peregrine?: { x: number; y: number }; dipper?: { x: number; bobbing: boolean }; fieldfares?: { x: number; y: number }[] } = {},
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

  const undergrowthY = groundStart - 1

  // Hoisted stream bounds — computed once, used by every section that needs stream position
  const forestSeed = forest.createdAt.slice(0, 10).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
  const streamX = Math.floor(width * 0.15 + hash(forestSeed * 13 + 77) % Math.floor(width * 0.65))
  const streamW = 14 + hash(streamX * 7 + 88) % 8

  // 2. Fill sky gradient
  for (let y = 0; y < SKY_ROWS; y++) {
    const skyColor = getSkyColor(y, period, blend)
    for (let x = 0; x < width; x++) {
      buffer[y]![x] = { char: "█", color: skyColor }
    }
  }

  // Horizon glow — intensified warm band at sky base during dawn/dusk
  if (period === "dawn" || period === "dusk") {
    const glowColor = period === "dawn"
      ? lerpColor("#6a2008", "#f09020", Math.min(1, blend * 1.5))
      : lerpColor("#b83010", "#5a1008", blend)
    for (let x = 0; x < width; x++) {
      buffer[SKY_ROWS - 1]![x] = { char: "█", color: glowColor }
    }
  }

  // 2a. Aurora borealis — winter nights only, curtain shifts with twinkle seed
  if (season === "winter" && period === "night") {
    const seed = options.twinkleSeed ?? 0
    const auroraColors = ["#205a38", "#3a9a50", "#4cb870", "#285a90", "#7030a8"] as const
    for (let x = 0; x < width; x++) {
      const wave = Math.sin(x * 0.28 + seed * 0.45)  // ripple shifts with seed
      const h = hash(x * 17 + seed * 5 + 33333)
      if (h % 3 === 0) continue  // ~33% skip = sparse curtain
      const curtainHeight = Math.max(1, Math.round((wave * 0.5 + 0.5) * 2.5))
      const colorIdx = hash(x * 7 + 44444) % auroraColors.length
      const col = auroraColors[colorIdx]!
      for (let y = 0; y < curtainHeight && y < SKY_ROWS - 1; y++) {
        buffer[y]![x] = { char: y === curtainHeight - 1 ? "█" : "░", color: y === curtainHeight - 1 ? col : lerpColor(col, getSkyColor(y, "night", 0), 0.65) }
      }
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

  // 2b2. Crepuscular rays — warm light shafts at dawn/dusk fanning from horizon
  if ((period === "dawn" || period === "dusk") && !options.isRaining) {
    const rayColor = period === "dawn" ? "#d88038" : "#c04820"
    const spread = Math.floor(width * 0.09)
    const centerX = period === "dawn" ? Math.floor(width * 0.2) : Math.floor(width * 0.75)
    for (let i = 0; i < 6; i++) {
      const rx = centerX + (i - 2) * spread + hash(i * 31 + 55555) % (spread >> 1)
      if (rx < 0 || rx >= width) continue
      if (hash(rx * 17 + 33333) % 3 === 0) continue
      for (let y = 0; y < SKY_ROWS - 1; y++) {
        const fade = (SKY_ROWS - 1 - y) / (SKY_ROWS - 1)  // stronger near horizon
        buffer[y]![rx] = { char: "│", color: lerpColor(getSkyColor(y, period, blend), rayColor, fade * 0.45) }
      }
    }
  }

  // 2c. Shooting star trail
  for (const p of options.shootingStarTrail ?? []) {
    if (p.y >= 0 && p.y < SKY_ROWS && p.x >= 0 && p.x < width) {
      const brightness = p.y === 0 ? "#ffffff" : p.y === 1 ? "#ddddc8" : "#888870"
      buffer[p.y]![p.x] = { char: p.y < 2 ? "·" : ".", color: brightness }
    }
  }

  // Rainbow — post-rain arc in upper sky, ROYGBV bands across rows 1-2
  if (options.postRain && !options.isRaining) {
    const arcColors = ["#ff5050", "#ff9030", "#f0d020", "#50c050", "#3080e0", "#8040c0"] as const
    const arcStart = Math.floor(width * 0.12)
    const arcEnd = Math.floor(width * 0.88)
    for (let y = 1; y <= 2; y++) {
      for (let x = arcStart; x < arcEnd; x++) {
        if (hash(x * 11 + y * 37 + 66666) % 3 !== 0) continue
        const t = (x - arcStart) / (arcEnd - arcStart)
        const ci = Math.min(arcColors.length - 1, Math.floor(t * arcColors.length))
        buffer[y]![x] = { char: "░", color: arcColors[ci]! }
      }
    }
  }

  // 2d. Comet — rare slow-moving sky object, head + dimming tail
  if (options.comet) {
    const { x: cx, y: cy } = options.comet
    if (cy >= 0 && cy < SKY_ROWS) {
      const tailColors = ["#ffffff", "#d8d8c0", "#a0a080", "#686860", "#404038"] as const
      for (let i = 0; i < tailColors.length; i++) {
        const tx = cx - i - 1
        if (tx >= 0 && tx < width) {
          buffer[cy]![tx] = { char: i === 0 ? "·" : i < 3 ? "." : " ", color: tailColors[i]! }
        }
      }
      if (cx >= 0 && cx < width) buffer[cy]![cx] = { char: "*", color: "#ffffff" }
    }
  }

  // 3. Place stars — fade with sunrise/sunset, invisible during day
  for (const star of generateStars(width, biome, options.twinkleSeed ?? 0)) {
    let starColor = star.color
    if (period === "day") {
      starColor = lerpColor(starColor, getSkyColor(star.y, "day", 0), 0.97)
    } else if (period === "dawn") {
      starColor = lerpColor(starColor, getSkyColor(star.y, period, blend), blend * 0.92)
    } else if (period === "dusk") {
      starColor = lerpColor(starColor, getSkyColor(star.y, period, blend), (1 - blend) * 0.92)
    }
    buffer[star.y]![star.x] = { char: star.char, color: starColor }
  }

  // 4. Moon — phased, arcs through night sky, invisible during day
  const moonPhase = getMoonPhase(now)
  const moonChar = getMoonChar(moonPhase)
  if (moonChar && (period === "night" || (period === "dusk" && blend > 0.5) || (period === "dawn" && blend < 0.4))) {
    const moonBrightness = Math.sin(moonPhase * Math.PI)
    const baseColor = lerpColor("#7a7870", "#f0ead8", moonBrightness)
    const nightFade = period === "dusk" ? blend : period === "dawn" ? 1 - blend : 1
    const moonColor = lerpColor(getSkyColor(1, period, blend), baseColor, Math.min(1, nightFade * 1.4))
    // Arc: rises east at dusk, overhead at midnight, sets west at dawn
    const h = now.getHours()
    const nightProgress = h >= 20 ? (h - 20) / 8 : h < 4 ? (h + 4) / 8 : 0.5
    const moonX = Math.floor(width * (0.78 - nightProgress * 0.5))
    const moonY = Math.max(0, Math.round(Math.abs(nightProgress - 0.5) * 2.5))
    if (moonX >= 0 && moonX < width) {
      buffer[moonY]![moonX] = { char: moonChar, color: moonColor }
      // Full moon glow — warm halo on adjacent sky cells
      if (moonPhase > 0.44 && moonPhase < 0.56) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue
            const gx = moonX + dx; const gy = moonY + dy
            if (gy >= 0 && gy < SKY_ROWS && gx >= 0 && gx < width && !buffer[gy]![gx]?.color) {
              buffer[gy]![gx] = { char: "░", color: lerpColor(getSkyColor(gy, period, blend), "#e8d8a0", 0.22) }
            }
          }
        }
      }
    }
  }

  // 4b. Clouds — rendered after stars/moon so they cover them; birds/bats drawn later in front
  if (options.clouds) {
    for (const c of options.clouds) {
      drawCloud(buffer, c.x, c.y, c.width, c.density, period, blend, width)
    }
  }

  // 4c. Aurora borealis — winter nights, animated green/teal/purple curtains in sky
  if (options.aurora && (period === "night" || (period === "dusk" && blend > 0.7))) {
    const aur = options.aurora
    const aurColors = ["#20e860", "#10d8a0", "#40b8e0", "#9040e0", "#20d060"]
    for (let x = 0; x < width; x++) {
      const wave = Math.sin(aur.phase + x * 0.18) * 0.5 + 0.5
      const wave2 = Math.sin(aur.phase * 0.7 + x * 0.27 + 1.4) * 0.3 + 0.3
      const curtainHeight = Math.floor((wave * wave2 + 0.1) * aur.intensity * (SKY_ROWS - 1))
      if (curtainHeight <= 0) continue
      const col = aurColors[Math.floor((Math.sin(aur.phase * 0.4 + x * 0.12) + 1) * 2) % aurColors.length]!
      for (let y = 0; y < curtainHeight && y < SKY_ROWS - 1; y++) {
        const fade = (curtainHeight - y) / curtainHeight
        const alpha = aur.intensity * fade * 0.7
        if (alpha < 0.1) continue
        const existing = buffer[y]![x]?.color ?? getSkyColor(y, period, blend)
        const blended = lerpColor(existing, col, alpha)
        const char = fade > 0.6 ? "│" : fade > 0.3 ? "▌" : "░"
        buffer[y]![x] = { char, color: blended }
      }
    }
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

  // 5b. Fallen log — deterministic, appears in mature forest (≥20 trees), moss-covered
  if (forest.trees.length >= 20) {
    const logSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const logX = Math.floor(width * 0.28 + hash(logSeed * 7 + 11111) % Math.floor(width * 0.42))
    const logW = 5 + hash(logSeed * 3 + 22222) % 5
    const logY = groundStart - 1
    const isFoxfire = period === "night" && season === "summer"
    // Decomposition stage based on forest age
    const decayStage = forest.trees.length >= 100 ? 3 : forest.trees.length >= 60 ? 2 : forest.trees.length >= 35 ? 1 : 0
    for (let i = 0; i < logW; i++) {
      const lx = logX + i
      if (lx < 0 || lx >= width) continue
      const lh = hash(lx * 41 + logSeed + 33333)
      const logColor = lerpColor("#5a3820", "#3a2010", i / logW)
      if (isFoxfire && lh % 4 === 0) {
        buffer[logY]![lx] = { char: "░", color: lerpColor("#1a6030", "#40d060", (lh % 10) / 10) }
      } else if (decayStage === 3) {
        // Nearly soil — crumbling, barely distinguishable from ground
        buffer[logY]![lx] = { char: lh % 4 === 0 ? "·" : "░", color: lerpColor(logColor, biome.ground[0]!, 0.7) }
      } else if (decayStage === 2) {
        // Heavy moss, fungi erupting, soft wood
        buffer[logY]![lx] = { char: lh % 3 === 0 ? "♦" : "░", color: lh % 3 === 0 ? "#6a3818" : lerpColor(logColor, "#4a7828", 0.75) }
      } else if (decayStage === 1) {
        // Mossy with bark fragments
        const hasMoss = lh % 3 === 0; const isBark = lh % 5 === 0
        buffer[logY]![lx] = { char: hasMoss ? "░" : isBark ? "≡" : "─", color: hasMoss ? lerpColor(logColor, "#4a6828", 0.65) : logColor }
      } else {
        // Fresh fallen — mainly bark
        buffer[logY]![lx] = { char: lh % 5 === 0 ? "≡" : "─", color: logColor }
      }
    }
  }

  // 5c. Wildflowers — spring/summer understory scatter
  if ((season === "spring" || season === "summer") && forest.trees.length >= 5) {
    const flowerPalette = season === "spring"
      ? ["#e0e040", "#f0f0d0", "#9070d0", "#80c8e8"]   // dandelion, daisy, bluebell, forget-me-not
      : ["#d03020", "#4880d0", "#e8cc30", "#d048a0"]    // poppy, cornflower, buttercup, clover
    for (let x = 0; x < width; x++) {
      const h = hash(x * 67 + forest.trees.length * 13 + 44447)
      if (h % 9 !== 0) continue
      const flowerY = groundStart - 1
      if (!buffer[flowerY]![x]?.color)
        buffer[flowerY]![x] = { char: h % 3 === 0 ? "∗" : "·", color: flowerPalette[h % flowerPalette.length]! }
    }
  }

  // Reed mace (bulrush/cattail) — beside stream; `◉` brown seed head on `|` stem; summer/autumn
  if ((season === "summer" || season === "autumn") && forest.trees.length >= 10) {
    for (let dx = -4; dx <= streamW + 4; dx++) {
      const rx = streamX + dx
      if (rx < 0 || rx >= width) continue
      if (hash(rx * 41 + forestSeed + 11113) % 7 !== 0) continue
      const stalkY = undergrowthY
      const headY = undergrowthY - 1
      if (!buffer[stalkY]![rx]?.color) buffer[stalkY]![rx] = { char: "|", color: "#7a6030" }
      if (headY >= SKY_ROWS && !buffer[headY]![rx]?.color) buffer[headY]![rx] = { char: "◉", color: "#5a3820" }
    }
  }

  // Purple loosestrife — late summer (July-Sept), tall spikes beside stream; vivid violet
  if ((season === "summer" || season === "autumn") && forest.trees.length >= 10) {
    const m = now.getMonth()
    if (m >= 6 && m <= 8) { // July-September
      for (let dx = -5; dx <= 5; dx++) {
        const px = streamX + dx
        if (px < 0 || px >= width) continue
        if (!buffer[undergrowthY]![px]?.color && hash(px * 37 + forestSeed + 55551) % 4 === 0)
          buffer[undergrowthY]![px] = { char: "↑", color: "#9040b8" }
      }
    }
  }

  // Dog rose — summer pink blooms in bramble/edge patches; hedgerow classic
  if (season === "summer" && forest.trees.length >= 8) {
    const roseX = Math.floor(width * 0.65 + hash(forestSeed * 7 + 33337) % Math.floor(width * 0.25))
    for (let dx = 0; dx < 4; dx++) {
      const rx = roseX + dx
      if (rx >= width) continue
      if (!buffer[undergrowthY]![rx]?.color) {
        const roseColors = ["#e070a0", "#f090b0", "#e060a8"]
        buffer[undergrowthY]![rx] = { char: dx % 2 === 0 ? "✿" : "·", color: roseColors[dx % roseColors.length]! }
      }
    }
  }

  // Elderflower — May-July, flat white flower heads on elder shrubs
  if ((season === "spring" || season === "summer") && forest.trees.length >= 10) {
    const m = now.getMonth()
    if (m >= 4 && m <= 6) { // May-July
      const elderX = Math.floor(width * 0.35 + hash(forestSeed * 11 + 22221) % Math.floor(width * 0.3))
      for (let dx = 0; dx < 3; dx++) {
        const ex = elderX + dx
        if (ex >= width) continue
        if (!buffer[undergrowthY]![ex]?.color)
          buffer[undergrowthY]![ex] = { char: "✤", color: "#f0f0e0" } // cream-white
      }
    }
  }

  // Wood anemone — pale star flowers carpet shaded woodland floor in early spring under canopy
  if (season === "spring" && forest.trees.length >= 5) {
    const m = now.getMonth()
    if (m >= 2 && m <= 4) { // March-May
      for (const tree of forest.trees) {
        if (tree.growth < 0.5 || tree.type === "stump") continue
        for (let dx = -4; dx <= 4; dx++) {
          const ax = tree.x + dx
          if (ax < 0 || ax >= width) continue
          if (hash(ax * 17 + tree.id * 31 + 12345) % 5 !== 0) continue
          if (!buffer[undergrowthY]![ax]?.color)
            buffer[undergrowthY]![ax] = { char: "✦", color: "#eeece0" }
        }
      }
    }
  }

  // Catkins — birch and willow trees dangle yellow-green catkins in early spring
  if (season === "spring" && forest.trees.length >= 3) {
    const m = now.getMonth()
    if (m >= 1 && m <= 4) { // Feb-May
      const catkinSpecies = ["birch", "willow"]
      for (const tree of forest.trees) {
        if (!catkinSpecies.includes(tree.type) || tree.growth < 0.4) continue
        const catkinColor = tree.type === "birch" ? "#c8c830" : "#a8b828"
        for (let dx = -3; dx <= 3; dx++) {
          const cx = tree.x + dx
          if (cx < 0 || cx >= width) continue
          if (hash(cx * 23 + tree.id * 19 + 55557) % 3 !== 0) continue
          if (!buffer[undergrowthY]![cx]?.color)
            buffer[undergrowthY]![cx] = { char: "∿", color: catkinColor }
        }
      }
    }
  }

  // Bracken fern — summer/autumn, distinctive fronds in undergrowth near mature trees
  if ((season === "summer" || season === "autumn") && forest.trees.length >= 10) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.6 || tree.type === "stump") continue
      if (hash(tree.id * 43 + 55557) % 5 !== 0) continue // 20% of trees have bracken
      for (let dx = -4; dx <= 4; dx++) {
        const bx = tree.x + dx
        if (bx < 0 || bx >= width) continue
        if (hash(bx * 59 + tree.id * 31 + 44443) % 3 !== 0) continue
        if (buffer[undergrowthY]![bx]?.color) continue
        buffer[undergrowthY]![bx] = { char: dx % 2 === 0 ? "ψ" : "∿", color: season === "autumn" ? "#9a6820" : "#4a7830" }
      }
    }
  }

  // Heat shimmer — summer midday, ground chars wobble (alternate between base and shifted color)
  if (season === "summer" && period === "day") {
    const h2 = now.getHours()
    if (h2 >= 12 && h2 <= 15) {
      const seed5 = options.twinkleSeed ?? 0
      for (let x = 0; x < width; x++) {
        if (hash(x * 53 + seed5 * 7 + 77771) % 6 !== 0) continue
        const cell = buffer[groundStart]![x]
        if (cell?.color)
          buffer[groundStart]![x] = { char: "░", color: lerpColor(cell.color, "#d0a850", 0.25) }
      }
    }
  }

  // Bluebell carpet — woodland floor turns violet-blue in April-May; iconic spring event
  if (season === "spring" && forest.trees.length >= 8) {
    const m = now.getMonth()
    if (m === 3 || m === 4) { // April-May
      const density = m === 3 ? 5 : 7
      const bluebellColors = ["#7050d0", "#8060e0", "#6040c0", "#9070d0"]
      for (let x = 0; x < width; x++) {
        if (hash(x * 61 + 66661) % density !== 0) continue
        if (buffer[undergrowthY]![x]?.color) continue
        const col = bluebellColors[hash(x * 37 + 44449) % bluebellColors.length]!
        buffer[undergrowthY]![x] = { char: "∗", color: col }
      }
    }
  }

  // Primrose patch — pale yellow flowers Feb-April before bluebells
  if (season === "spring" || season === "winter") {
    const m = now.getMonth()
    if (m === 1 || m === 2 || m === 3) { // Feb-April
      for (let x = 0; x < width; x++) {
        if (hash(x * 79 + forest.trees.length * 7 + 22229) % 14 !== 0) continue
        if (buffer[undergrowthY]![x]?.color) continue
        buffer[undergrowthY]![x] = { char: "✤", color: "#e8d828" } // pale yellow
      }
    }
  }

  // Fly agaric — iconic red-capped mushroom with white dots; autumn under birch/pine
  if (season === "autumn" && forest.trees.length >= 10) {
    const flySpecies = new Set(["birch", "pine", "oak"])
    for (const tree of forest.trees) {
      if (!flySpecies.has(tree.type) || tree.growth < 0.7) continue
      if (hash(tree.id * 67 + 44443) % 12 !== 0) continue // ~8% chance
      const fax = tree.x + (hash(tree.id * 31 + 22229) % 2 === 0 ? 3 : -3)
      if (fax < 0 || fax >= width) continue
      if (!buffer[undergrowthY]![fax]?.color) {
        buffer[undergrowthY]![fax] = { char: "◆", color: "#e01818" } // red cap
        if (fax + 1 < width && !buffer[undergrowthY]![fax + 1]?.color)
          buffer[undergrowthY]![fax + 1] = { char: "·", color: "#f8f8f8" } // white dot
      }
    }
  }

  // Woodpecker nest cavity — oval hole in trunk of large old trees
  if (forest.trees.length >= 30) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.95 || tree.type === "stump") continue
      if (hash(tree.id * 97 + 11119) % 8 !== 0) continue // ~12% of very old trees
      for (let y = groundStart - 5; y < groundStart - 2; y++) {
        const cell = buffer[y]![tree.x]
        if (cell?.color && cell.char === "█") {
          buffer[y]![tree.x] = { char: "◉", color: "#2a1808" } // dark cavity
          break
        }
      }
    }
  }

  // Mushroom spore cloud — after rain in summer/autumn, puff of spores from ground clusters
  if (options.postRain && (season === "summer" || season === "autumn") && options.groundMushrooms && options.groundMushrooms.length > 0) {
    const seed6 = (options.twinkleSeed ?? 0) % 15
    if (seed6 < 3) { // occasional burst
      for (const mx of options.groundMushrooms) {
        for (let dy = 1; dy <= 2; dy++) {
          const sy = undergrowthY - dy
          if (sy < SKY_ROWS) continue
          for (let dx = -1; dx <= 1; dx++) {
            const sx = mx + dx
            if (sx < 0 || sx >= width) continue
            if (!buffer[sy]![sx]?.color)
              buffer[sy]![sx] = { char: "·", color: "#c8a8e0" } // purple-tinged spores
          }
        }
      }
    }
  }

  // Owl pellet — dawn, compressed fur/bone at base of owl's roost tree
  if ((period === "dawn" || (period === "night" && blend < 0.3)) && forest.trees.length > 0) {
    const roostIdx2 = hash(forest.trees.length * 13 + 42) % forest.trees.length
    const roostTree = forest.trees[roostIdx2]!
    if (roostTree.x >= 0 && roostTree.x < width && !buffer[groundStart]![roostTree.x]?.color)
      buffer[groundStart]![roostTree.x] = { char: "◎", color: "#706050" }
  }

  // Fox earth entrance — triangular den hole in ground near old forest edges
  if (forest.trees.length >= 20) {
    const foxSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const foxX = 2 + hash(foxSeed * 17 + 33337) % Math.floor(width * 0.2)
    if (!buffer[groundStart]![foxX]?.color)
      buffer[groundStart]![foxX] = { char: "▽", color: "#4a2c10" }
    // Earth mound beside entrance
    if (foxX + 1 < width && !buffer[groundStart]![foxX + 1]?.color)
      buffer[groundStart]![foxX + 1] = { char: "░", color: lerpColor(biome.ground[0]!, "#8a5830", 0.5) }
  }

  // Fox cubs — spring (March-May), tumbling near the earth entrance; tiny `◦` shapes
  if (season === "spring" && forest.trees.length >= 20) {
    const m = now.getMonth()
    if (m >= 2 && m <= 4) {
      const foxSeed2 = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      const foxX2 = 2 + hash(foxSeed2 * 17 + 33337) % Math.floor(width * 0.2)
      for (let di = 2; di <= 5; di++) {
        const cx = foxX2 + di
        if (cx >= width) continue
        if (!buffer[undergrowthY]![cx]?.color)
          buffer[undergrowthY]![cx] = { char: "◦", color: "#c07030" }
      }
    }
  }

  // Ancient tree gnarling — root buttresses and gnarled bark on very old trees
  if (forest.trees.length >= 50) {
    for (const tree of forest.trees) {
      if (tree.growth < 1.0 || tree.type === "stump") continue
      if (hash(tree.id * 89 + 77777) % 4 !== 0) continue // ~25% of fully grown trees
      // Visible surface root
      for (let dx = -2; dx <= 2; dx++) {
        const rx = tree.x + dx
        if (rx < 0 || rx >= width || rx === tree.x) continue
        if (!buffer[groundStart - 1]![rx]?.color)
          buffer[groundStart - 1]![rx] = { char: "─", color: lerpColor(biome.ground[0]!, "#8a5030", 0.4) }
      }
    }
  }

  // Nettle bed — stinging nettles in disturbed/open patches, spring-summer
  if ((season === "spring" || season === "summer") && forest.trees.length >= 15) {
    const nettleSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const nettleX = Math.floor(width * 0.6 + hash(nettleSeed * 11 + 44443) % Math.floor(width * 0.3))
    for (let dx = 0; dx < 5; dx++) {
      const nx = nettleX + dx
      if (nx >= width) continue
      if (!buffer[undergrowthY]![nx]?.color)
        buffer[undergrowthY]![nx] = { char: "↑", color: "#507830" }
    }
  }

  // Robin — perches on stumps and low branches year-round; red-orange breast dot
  for (const tree of forest.trees) {
    if (tree.type !== "stump" && tree.growth < 0.85) continue
    if (hash(tree.id * 47 + 99991) % 9 !== 0) continue
    const robinX = tree.x
    const robinY = tree.type === "stump" ? groundStart - 2 : undergrowthY - 1
    if (robinY < SKY_ROWS || robinX < 0 || robinX >= width) continue
    if (!buffer[robinY]![robinX]?.color)
      buffer[robinY]![robinX] = { char: "◦", color: "#e04020" }
  }

  // Winter snow on top ground row
  if (season === "winter") {
    for (let x = 0; x < width; x++) {
      const snowChar = hash(x * 13 + 77) % 3 === 0 ? "░" : "█"
      buffer[groundStart]![x] = { char: snowChar, color: lerpColor(biome.ground[0]!, "#c8d0d8", 0.6) }
    }
  }

  // Pine cone litter — autumn/winter, `▼` cones scattered under conifer trees
  if (season === "autumn" || season === "winter") {
    const conifers2 = new Set(["pine", "araucaria", "eucalyptus"])
    for (const tree of forest.trees) {
      if (!conifers2.has(tree.type) || tree.growth < 0.5) continue
      for (let dx = -4; dx <= 4; dx++) {
        const cx = tree.x + dx
        if (cx < 0 || cx >= width) continue
        if (hash(cx * 53 + tree.id * 29 + 88881) % 5 !== 0) continue
        if (!buffer[groundStart]![cx]?.color)
          buffer[groundStart]![cx] = { char: "▼", color: "#6a4820" }
      }
    }
  }

  // Bat roost — daytime, sleeping bat `⊃` visible in ancient hollow tree
  if (period === "day" && forest.trees.length >= 25) {
    for (const tree of forest.trees) {
      if (tree.growth < 1.0 || tree.type === "stump") continue
      if (hash(tree.id * 97 + 88887) % 8 !== 0) continue // only some trees have roosts
      const roostX = tree.x
      const roostY = groundStart - 4
      if (roostY >= SKY_ROWS && !buffer[roostY]![roostX]?.color)
        buffer[roostY]![roostX] = { char: "⊃", color: "#3a2828" }
    }
  }

  // Icicles — winter, drip from low branches onto snow; pale ice-blue hanging spikes
  if (season === "winter" && !options.isRaining) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.5 || tree.type === "stump") continue
      for (let i = 0; i < 3; i++) {
        const ix = tree.x - 2 + i * 2 + hash(tree.id * 11 + i * 7 + 33339) % 3 - 1
        if (ix < 0 || ix >= width) continue
        if (!buffer[groundStart]![ix]?.color)
          buffer[groundStart]![ix] = { char: "|", color: "#b0d8f4" }
      }
    }
  }

  // Bear paw prints — winter only, appear as trail of `v` on ground
  if (season === "winter" && options.bearPrints && options.bearPrints.length > 0) {
    for (const px of options.bearPrints) {
      if (px >= 0 && px < width) {
        buffer[groundStart]![px] = { char: "v", color: "#7a6858" }
      }
    }
  }

  // Stream — meanders through second ground row once forest is established (grove+)
  if (forest.trees.length >= 10) {
    const seed = options.twinkleSeed ?? 0
    const streamColor = options.isRaining ? "#3a7ab0" : options.postRain ? "#5aaaca" : "#2a6a8a"
    for (let i = 0; i < streamW; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (season === "winter") {
        const month = now.getMonth()
        const isBreakup = month >= 1 && month <= 2  // Feb-March: ice breakup
        const h = hash(sx * 31 + 33333)
        const isIce = h % 2 === 0
        if (isBreakup) {
          // Ice floes with open water cracks — transitional pattern
          const crackPhase = hash(sx * 7 + (options.twinkleSeed ?? 0) * 3 + 99991) % 5
          buffer[groundStart + 1]![sx] = crackPhase === 0
            ? { char: "~", color: "#3a6888" }   // open water crack
            : crackPhase === 1
              ? { char: "·", color: "#88aac0" } // water droplet
              : { char: isIce ? "─" : "≈", color: isIce ? "#a0b8cc" : "#5888a0" }
        } else {
          buffer[groundStart + 1]![sx] = isIce ? { char: "─", color: "#a8c0d0" } : { char: "~", color: "#3a5878" }
        }
      } else {
        const isFullMoon = moonPhase > 0.44 && moonPhase < 0.56
        const isNightPeriod = period === "night"
        const streamMid = streamX + Math.floor(streamW / 2)
        const moonReflect = isFullMoon && isNightPeriod && Math.abs(sx - streamMid) <= 1
        const starReflect = isNightPeriod && hash(sx * 41 + seed * 23 + 11111) % 5 === 0
        const shimmer = hash(sx * 53 + seed * 37 + 22222) % 2 === 0
        buffer[groundStart + 1]![sx] = moonReflect
          ? { char: "◉", color: lerpColor("#5070a0", "#d8c870", 0.7) }
          : starReflect
            ? { char: "·", color: "#5070a0" }
            : { char: shimmer ? "≈" : "~", color: streamColor }
      }
    }
  }

  // Stream morning mist — cool air above water at dawn, pale wisps on second ground row
  if ((period === "dawn" || (period === "day" && blend < 0.2)) && forest.trees.length >= 10 && !options.isRaining) {
    for (let i = 0; i < streamW; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 31 + 99991) % 3 === 0)
        buffer[groundStart]![sx] = { char: "░", color: lerpColor("#c0c8d0", "#a8b8c8", hash(sx * 17 + 44443) % 10 / 10) }
    }
  }

  // Frog spawn — early spring (Feb-March), jelly-mass clusters in still stream shallows; `○`
  if (season === "spring" && forest.trees.length >= 5) {
    const m = now.getMonth()
    if (m >= 1 && m <= 2) { // Feb-March
      for (let dx = 1; dx <= 5; dx++) {
        const sx = streamX + dx
        if (sx < 0 || sx >= width) continue
        if (hash(sx * 53 + forestSeed + 22221) % 3 === 0)
          buffer[groundStart + 1]![sx] = { char: "○", color: "#6a8050" }
      }
    }
  }

  // Water crowfoot — white floating flowers on stream surface in summer; `○` on water
  if (season === "summer" && forest.trees.length >= 10 && !options.isRaining) {
    for (let i = 2; i < streamW - 2; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 43 + forestSeed + 55553) % 7 === 0)
        buffer[groundStart + 1]![sx] = { char: "○", color: "#f0f0e8" }
    }
  }

  // Rain splashes on stream — `·` drip rings when raining
  if (options.isRaining && forest.trees.length >= 10) {
    const seed2 = options.twinkleSeed ?? 0
    for (let i = 0; i < streamW; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 29 + seed2 * 17 + 88887) % 4 === 0)
        buffer[groundStart + 1]![sx] = { char: "·", color: "#8ab8d0" }
    }
  }

  // Beaver dam — mature forest (≥40 trees), deterministic structure across stream
  if (forest.trees.length >= 40) {
    const damStart = streamX + Math.floor(streamW * 0.3)
    const damW = 5 + hash(forestSeed * 3 + 55551) % 4
    for (let i = 0; i < damW; i++) {
      const dx = damStart + i
      if (dx < 0 || dx >= width) continue
      const isEnd = i === 0 || i === damW - 1
      buffer[groundStart + 1]![dx] = { char: isEnd ? "▐" : "━", color: lerpColor("#7a5030", "#5a3818", i / damW) }
      if (!buffer[groundStart]![dx]?.color || buffer[groundStart]![dx]!.char === "█")
        buffer[groundStart]![dx] = { char: "░", color: "#6a5028" }
    }
  }

  // Stream bank rushes — tall `|` reeds at stream margins, spring-autumn
  if (season !== "winter" && forest.trees.length >= 10) {
    const reedColor = season === "autumn" ? "#8a7030" : "#4a7830"
    for (const side of [-1, streamW] as const) {
      const rx = streamX + side
      if (rx < 0 || rx >= width) continue
      for (let dy = 1; dy <= 2; dy++) {
        const ry = groundStart - dy
        if (ry < SKY_ROWS) break
        if (!buffer[ry]![rx]?.color)
          buffer[ry]![rx] = { char: dy === 1 ? "╷" : "╷", color: reedColor }
      }
      if (!buffer[groundStart]![rx]?.color)
        buffer[groundStart]![rx] = { char: "│", color: reedColor }
    }
  }

  // Stream fish — brief silver dart crossing the water; spawning salmon turn red in autumn
  if (options.streamFish) {
    const { x: fx, leftward } = options.streamFish
    const fy = groundStart + 1
    const isSpawningSeason = now.getMonth() >= 8 && now.getMonth() <= 10 // Sep-Nov
    const fishColor = isSpawningSeason ? "#e04828" : "#80c0d0"
    const fishTailColor = isSpawningSeason ? "#c03018" : "#60a0b0"
    if (fx >= 0 && fx < width) {
      buffer[fy]![fx] = { char: leftward ? "<" : ">", color: fishColor }
      const tail = leftward ? fx + 1 : fx - 1
      if (tail >= 0 && tail < width) buffer[fy]![tail] = { char: leftward ? ">" : "<", color: fishTailColor }
    }
  }

  // Stream bed stones — pebbles visible in clear water, especially in low-flow seasons
  if (forest.trees.length >= 10 && !options.isRaining && season !== "winter") {
    for (let i = 1; i < streamW - 1; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 43 + forestSeed * 7 + 55553) % 5 !== 0) continue
      const gy = groundStart + 1
      const cell = buffer[gy]![sx]
      if (cell?.char === "~" || cell?.char === "≈")
        buffer[gy]![sx] = { char: "·", color: lerpColor(cell.color ?? "#2a6a8a", "#888878", 0.45) }
    }
  }

  // Water striders — tiny `×` insects walking on stream surface, spring-autumn
  if (season !== "winter" && forest.trees.length >= 10) {
    const seedW = options.twinkleSeed ?? 0
    const striderCount = 2 + hash(seedW * 7 + 33331) % 3
    for (let i = 0; i < striderCount; i++) {
      const sx = streamX + 1 + hash(i * 17 + seedW * 5 + 44441) % (streamW - 2)
      if (sx < 0 || sx >= width) continue
      if (buffer[groundStart + 1]![sx]?.char === "~" || buffer[groundStart + 1]![sx]?.char === "≈")
        buffer[groundStart + 1]![sx] = { char: "×", color: "#3a5870" }
    }
  }

  // Mayfly hatch — spring/early summer mass emergence above stream, rising `|` specks
  if (options.mayflyHatch && forest.trees.length >= 10) {
    const seedMF = options.twinkleSeed ?? 0
    for (let i = 0; i < streamW; i++) {
      const mx = streamX + i
      if (mx < 0 || mx >= width) continue
      for (let rise = 1; rise <= 5; rise++) {
        const my = groundStart + 1 - rise
        if (my < SKY_ROWS) break
        if (!buffer[my]![mx]?.color && hash(mx * 13 + seedMF * 7 + rise * 31 + 44447) % 3 === 0)
          buffer[my]![mx] = { char: rise <= 2 ? "|" : "·", color: lerpColor("#90c8e0", "#c8e8f0", rise / 5) }
      }
    }
  }

  // 6. Composite trees — full-stage trees get a stable per-tree height bonus for natural variation
  const treeBaseY = groundStart - 1
  for (const tree of forest.trees) {
    const heightBonus = tree.growth >= 0.8 ? hash(tree.id * 13 + 99991) % 3 : 0
    const effectiveBaseY = treeBaseY - heightBonus
    compositeSprite(buffer, getSprite(tree.type, tree.growth, tree.id % 3), tree.x, effectiveBaseY)
    // Draw trunk extension to bridge any gap to the ground
    if (heightBonus > 0) {
      for (let ei = 0; ei < heightBonus; ei++) {
        const extY = treeBaseY - ei
        if (extY < buffer.length && !buffer[extY]![tree.x]?.color) {
          buffer[extY]![tree.x] = { char: "█", color: "#7a5a30" }
        }
      }
    }
  }

  // 6a. Species-specific autumn canopy tinting — each deciduous species turns its own fall color
  if (season === "autumn") {
    const fallColors: Record<string, string> = {
      oak: "#8a4818", cherry: "#c01828", maple: "#d03010", birch: "#d0a820",
      ginkgo: "#e0c010", willow: "#8a9820", beech: "#b04818", elm: "#9a6020",
      banyan: "#607020", acacia: "#9a8020",
    }
    for (const tree of forest.trees) {
      const col = fallColors[tree.type]
      if (!col || tree.type === "stump" || tree.growth < 0.3) continue
      const sprite = getSprite(tree.type, tree.growth, tree.id % 3)
      const half = Math.floor(sprite.width / 2)
      // Tint upper canopy rows (not trunk rows at bottom of sprite)
      const canopyRows = Math.ceil(sprite.rows.length * 0.65)
      const heightBonus = tree.growth >= 0.8 ? hash(tree.id * 13 + 99991) % 3 : 0
      const treeTop = treeBaseY - heightBonus - sprite.rows.length + 1
      for (let row = 0; row < canopyRows; row++) {
        const y = treeTop + row
        if (y < SKY_ROWS || y >= groundStart) continue
        for (let dx = -half; dx <= half; dx++) {
          const x = tree.x + dx
          if (x < 0 || x >= width) continue
          const cell = buffer[y]![x]
          if (cell?.color) buffer[y]![x] = { char: cell.char, color: lerpColor(cell.color, col, 0.6) }
        }
      }
    }
  }

  // 6b0. Cicadas — summer heat, camouflaged ∧ shapes flickering in mid-canopy
  if (season === "summer") {
    const h = now.getHours()
    if (h >= 9 && h <= 19 && forest.trees.length >= 8) {
      for (const tree of forest.trees) {
        if (tree.type === "stump" || tree.growth < 0.7) continue
        const sprite = getSprite(tree.type, tree.growth)
        const half = Math.floor(sprite.width / 2)
        for (let dx = -half + 1; dx < half; dx++) {
          const cx = tree.x + dx
          if (cx < 0 || cx >= width) continue
          const twinklePhase = ((options.twinkleSeed ?? 0) + cx * 7 + tree.id * 13) % 60
          if (twinklePhase > 2) continue // sparse, twinkle-animated
          const midRow = SKY_ROWS + Math.floor(TREE_ROWS * 0.45)
          for (let y = SKY_ROWS + 1; y <= midRow; y++) {
            if (buffer[y]![cx]?.color) {
              buffer[y]![cx] = { char: "∧", color: "#8a7840" }
              break
            }
          }
        }
      }
    }
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

  // Squirrel drey — winter, tight leaf-ball nest high in oak/ash/beech; `●` near canopy top
  if (season === "winter") {
    const dreySpecies = new Set(["oak", "maple", "birch"])
    for (const tree of forest.trees) {
      if (!dreySpecies.has(tree.type) || tree.growth < 0.7) continue
      if (hash(tree.id * 59 + 44447) % 5 !== 0) continue // ~20% of eligible trees
      const dreyX = tree.x + 1
      const dreyY = SKY_ROWS + 1 // high in canopy
      if (dreyX >= width || dreyY >= groundStart) continue
      if (buffer[dreyY]![dreyX]?.color) // only where canopy exists
        buffer[dreyY]![dreyX] = { char: "●", color: "#5a4020" }
    }
  }

  // Bracket fungi — shelf fungus growing on ancient tree trunks; autumn/winter; chestnut brown
  if (season === "autumn" || season === "winter") {
    for (const tree of forest.trees) {
      if (tree.growth < 0.9 || tree.type === "stump") continue
      if (hash(tree.id * 41 + 66661) % 4 !== 0) continue // ~25% of ancient trees
      const bx = tree.x + 1 // right side of trunk
      if (bx >= width) continue
      const by = groundStart - 3 // mid-trunk height
      if (by >= SKY_ROWS && by < groundStart && !buffer[by]![bx]?.color)
        buffer[by]![bx] = { char: "⊣", color: "#8a4820" }
    }
  }

  // 6c2. Tree hollows — ~20% of fully mature trees have a trunk cavity
  for (const tree of forest.trees) {
    if (tree.growth < 1.0 || tree.type === "stump") continue
    if (hash(tree.id * 71 + 88881) % 5 !== 0) continue
    for (let y = SKY_ROWS + 2; y < groundStart - 1; y++) {
      const cell = buffer[y]![tree.x]
      if (cell?.color && cell.char === "█") {
        buffer[y]![tree.x] = { char: "○", color: lerpColor(cell.color, "#2a1808", 0.5) }
        break
      }
    }
  }

  // 6c3. Ivy vines — ~25% of trees with growth ≥ 0.8, creep up left trunk edge
  for (const tree of forest.trees) {
    if (tree.growth < 0.8 || tree.type === "stump") continue
    if (hash(tree.id * 53 + 77771) % 4 !== 0) continue
    const ivyCol = tree.x - 1
    if (ivyCol < 0 || ivyCol >= width) continue
    const ivyH = 1 + hash(tree.id * 37 + 44441) % 3
    for (let i = 0; i < ivyH; i++) {
      const ivyY = groundStart - 2 - i
      if (ivyY < SKY_ROWS) break
      if (!buffer[ivyY]![ivyCol]?.color)
        buffer[ivyY]![ivyCol] = { char: i % 2 === 0 ? "┆" : "╎", color: lerpColor("#3a7030", "#60a048", i / ivyH) }
    }
  }

  // Long-tailed tit flock — winter, small `·` birds bouncing through canopy edge
  if (options.titFlock && options.titFlock.length > 0) {
    for (const tit of options.titFlock) {
      if (tit.x < 0 || tit.x >= width || tit.y < 0 || tit.y >= buffer.length) continue
      if (!buffer[tit.y]![tit.x]?.color)
        buffer[tit.y]![tit.x] = { char: "·", color: "#e8d8d0" } // pale pink-white
    }
  }

  // Rose hips — autumn/winter red berries in undergrowth near forest edges
  if ((season === "autumn" || season === "winter") && forest.trees.length >= 8) {
    const hipSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    for (let i = 0; i < 3; i++) {
      const hx = Math.floor(hash(hipSeed * (i + 5) * 11 + 33331) % Math.max(1, width - 6)) + 3
      if (buffer[undergrowthY]![hx]?.color) continue
      buffer[undergrowthY]![hx] = { char: "·", color: "#e01818" } // red hip
      if (hx + 1 < width && !buffer[undergrowthY]![hx + 1]?.color)
        buffer[undergrowthY]![hx + 1] = { char: "·", color: "#c81010" }
    }
  }

  // Dormouse — hibernating winter ball under fallen log in mature forest
  if (season === "winter" && forest.trees.length >= 20) {
    const logSeedD = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const logXD = Math.floor(width * 0.28 + hash(logSeedD * 7 + 11111) % Math.floor(width * 0.42))
    const dormX = logXD + 2
    if (dormX >= 0 && dormX < width && !buffer[groundStart]![dormX]?.color)
      buffer[groundStart]![dormX] = { char: "●", color: "#c09050" } // golden-brown ball
  }

  // Wood pigeon — plump grey bird; `O` perched in upper canopy; ~10% of mature trees
  if (period !== "night" && forest.trees.length >= 8) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.85 || tree.type === "stump") continue
      if (hash(tree.id * 71 + 88883) % 10 !== 0) continue
      const sprite = getSprite(tree.type, tree.growth)
      const half = Math.floor(sprite.width / 2)
      const px = tree.x + (hash(tree.id * 53 + 22223) % 2 === 0 ? half - 1 : -(half - 1))
      if (px < 0 || px >= width) continue
      for (let y = SKY_ROWS; y < SKY_ROWS + 3; y++) {
        if (buffer[y]![px]?.color) {
          buffer[y]![px] = { char: "O", color: "#9090a8" } // grey-blue pigeon
          break
        }
      }
    }
  }

  // Mistletoe — spherical evergreen parasite in canopy of oak/apple/hawthorn; visible in winter
  if (forest.trees.length >= 15) {
    const mistletoeHosts = ["oak", "willow", "acacia"] as const
    for (const tree of forest.trees) {
      if (!mistletoeHosts.some(t => tree.type === t)) continue
      if (tree.growth < 0.85) continue
      if (hash(tree.id * 41 + 55559) % 7 !== 0) continue // ~14% of hosts
      const sprite = getSprite(tree.type, tree.growth)
      const mx = tree.x + (hash(tree.id * 23 + 33337) % 2 === 0 ? 1 : -1)
      if (mx < 0 || mx >= width) continue
      for (let y = SKY_ROWS; y < SKY_ROWS + 3; y++) {
        if (buffer[y]![mx]?.color) {
          buffer[y]![mx] = { char: "●", color: "#508030" }
          break
        }
      }
    }
  }

  // Old man's beard — wispy Clematis on shrub edges; autumn/winter trailing ░ wisps
  if ((season === "autumn" || season === "winter") && forest.trees.length >= 12) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.7 || tree.type === "stump") continue
      if (hash(tree.id * 59 + 33331) % 7 !== 0) continue // ~14% of mature trees
      const sprite = getSprite(tree.type, tree.growth)
      const wispX = tree.x + Math.floor(sprite.width / 2) + 1
      if (wispX < 0 || wispX >= width) continue
      for (let y = groundStart - 3; y < groundStart - 1; y++) {
        if (!buffer[y]![wispX]?.color)
          buffer[y]![wispX] = { char: "░", color: "#d8d8d0" } // wispy white-grey
      }
    }
  }

  // Stream flooding — heavy/post rain, stream overflows to undergrowth row
  if ((options.isRaining && (options.windStrength ?? 0) >= 1) || (options.postRain && season !== "winter")) {
    if (forest.trees.length >= 10) {
      if (options.isRaining) {
        // Expand stream to undergrowth row at edges
        const floodColor = "#3a7aaa"
        for (let i = 0; i < 2; i++) {
          const ex = streamX - 1 - i
          const ex2 = streamX + streamW + i
          if (ex >= 0 && !buffer[undergrowthY]![ex]?.color)
            buffer[undergrowthY]![ex] = { char: "~", color: floodColor }
          if (ex2 < width && !buffer[undergrowthY]![ex2]?.color)
            buffer[undergrowthY]![ex2] = { char: "~", color: floodColor }
        }
      }
    }
  }

  // Newt — aquatic amphibian in stream during spring breeding
  if (season === "spring" && forest.trees.length >= 10) {
    const m = now.getMonth()
    if (m >= 2 && m <= 5) { // March-June
      const seedN = options.twinkleSeed ?? 0
      const newtX = streamX + 2 + hash(seedN * 13 + 44441) % (streamW - 4)
      const newtY = groundStart + 1
      if (newtX >= 0 && newtX < width && (buffer[newtY]![newtX]?.char === "~" || buffer[newtY]![newtX]?.char === "≈"))
        buffer[newtY]![newtX] = { char: "∫", color: "#8a4838" } // dark red-brown
    }
  }

  // Holly shrub — winter evergreen with red berries; deterministic positions in undergrowth
  if (season === "winter" && forest.trees.length >= 12) {
    const hollySeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const hollyCount = 2 + hash(hollySeed * 7 + 11113) % 3
    for (let i = 0; i < hollyCount; i++) {
      const hx = Math.floor(hash(hollySeed * (i + 1) * 13 + 44443) % Math.max(1, width - 4)) + 2
      if (buffer[undergrowthY]![hx]?.color) continue
      buffer[undergrowthY]![hx] = { char: "♣", color: "#204820" } // dark holly green
      if (hx + 1 < width && !buffer[undergrowthY]![hx + 1]?.color)
        buffer[undergrowthY]![hx + 1] = { char: "·", color: "#d01818" } // red berry
    }
  }

  // 6c8. Treecreeper — spirals UP trunks; ~10% of mature trees; different from nuthatch
  if (period !== "night") {
    for (const tree of forest.trees) {
      if (tree.growth < 0.8 || tree.type === "stump") continue
      if (hash(tree.id * 83 + 44447) % 10 !== 0) continue
      const twinkle = options.twinkleSeed ?? 0
      const posOffset = Math.floor(Math.sin(twinkle * 0.25 + tree.id * 1.3) * 2)
      const tcY = groundStart - 4 - posOffset
      if (tcY < SKY_ROWS || tcY >= groundStart) continue
      const cell = buffer[tcY]![tree.x + 1]
      if (cell?.color && cell.char === "█")
        buffer[tcY]![tree.x + 1] = { char: "∧", color: "#9aaa88" } // streaky brown-buff
    }
  }

  // 6c7. Nuthatch — walks headfirst DOWN trunks; ~12% of mature trees; animated position
  if (period !== "night") {
    for (const tree of forest.trees) {
      if (tree.growth < 0.8 || tree.type === "stump") continue
      if (hash(tree.id * 79 + 55553) % 8 !== 0) continue
      const twinkle = options.twinkleSeed ?? 0
      const posOffset = Math.floor(Math.sin(twinkle * 0.3 + tree.id * 0.9) * 1.5)
      const nutY = groundStart - 3 + posOffset
      if (nutY < SKY_ROWS || nutY >= groundStart) continue
      const cell = buffer[nutY]![tree.x]
      if (cell?.color && cell.char === "█")
        buffer[nutY]![tree.x] = { char: "v", color: "#7090b8" } // blue-grey nuthatch
    }
  }

  // 6c5. Trunk shelf fungi — ~20% of ancient trees (growth ≥ 0.95), bracket mushroom on mid-trunk
  for (const tree of forest.trees) {
    if (tree.growth < 0.95 || tree.type === "stump") continue
    if (hash(tree.id * 61 + 99997) % 5 !== 0) continue
    const fungusX = tree.x + 1
    if (fungusX >= width) continue
    for (let y = groundStart - 3; y < groundStart - 1; y++) {
      const cell = buffer[y]![tree.x]
      if (cell?.color && cell.char === "█") {
        const fungusColor = lerpColor("#c06828", "#a04020", hash(tree.id * 41 + 33331) % 10 / 10)
        if (!buffer[y]![fungusX]?.color)
          buffer[y]![fungusX] = { char: "Γ", color: fungusColor }
        break
      }
    }
  }

  // 6c6. Lichen — grey-green crust on north-facing left bark of ancient trees (≥0.9 growth)
  for (const tree of forest.trees) {
    if (tree.growth < 0.9 || tree.type === "stump") continue
    if (hash(tree.id * 37 + 77771) % 3 !== 0) continue // ~33% of ancient trees
    const sprite = getSprite(tree.type, tree.growth)
    const leftX = tree.x - Math.floor(sprite.width / 2) - 1
    if (leftX < 0 || leftX >= width) continue
    for (let y = groundStart - 4; y < groundStart - 1; y++) {
      if (hash(tree.id * 19 + y * 53 + 33331) % 2 !== 0) continue
      const cell = buffer[y]![leftX]
      if (cell?.color) {
        buffer[y]![leftX] = { char: "·", color: lerpColor(cell.color, "#788850", 0.65) }
      }
    }
  }

  // 6c4. Bird nests — ~14% of mature trees have a cup nest in upper canopy, spring/summer
  if ((season === "spring" || season === "summer") && forest.trees.length >= 5) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.9 || tree.type === "stump") continue
      if (hash(tree.id * 89 + 66661) % 7 !== 0) continue
      const nestX = tree.x + (hash(tree.id * 23 + 11113) % 2 === 0 ? 1 : -1)
      if (nestX < 0 || nestX >= width) continue
      for (let y = SKY_ROWS; y < groundStart - 2; y++) {
        if (buffer[y]![nestX]?.color) {
          const hasChick = season === "spring" && hash(tree.id * 31 + 22221) % 3 === 0
          buffer[y]![nestX] = { char: hasChick ? "⌣" : "⌢", color: hasChick ? "#c89838" : "#8a6030" }
          break
        }
      }
    }
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

  // Barn owl — silent white ghost gliding at canopy level; ghostly pale wing glyph
  if (options.barnOwl && options.barnOwl.x >= 0 && options.barnOwl.x < width) {
    const { x: bx, y: by } = options.barnOwl
    if (by >= 0 && by < buffer.length) {
      buffer[by]![bx] = { char: "⊇", color: "#e8e0d0" } // pale white-cream
      const trail = bx - 1
      if (trail >= 0 && !buffer[by]![trail]?.color)
        buffer[by]![trail] = { char: "·", color: "#c0b8a8" }
    }
  }

  // 7. Birds
  for (const bird of options.birds ?? []) {
    if (bird.y >= 0 && bird.y < SKY_ROWS && bird.x >= 0 && bird.x < width) {
      buffer[bird.y]![bird.x] = { char: ">", color: "#7a7878" }
    }
  }

  // 7. Migration — V-formation of birds crossing sky in spring/autumn
  if (options.migration) {
    const { x: mx, y: my, size } = options.migration
    if (mx >= 0 && mx < width && my >= 0 && my < SKY_ROWS)
      buffer[my]![mx] = { char: ">", color: "#4a5060" }
    for (let i = 1; i <= size; i++) {
      const lx = mx - i * 2; const ly = my + i; const rx = mx - i * 2; const ry = my - i
      if (lx >= 0 && lx < width && ly >= 0 && ly < SKY_ROWS) buffer[ly]![lx] = { char: ">", color: "#4a5060" }
      if (rx >= 0 && rx < width && ry >= 0 && ry < SKY_ROWS) buffer[ry]![rx] = { char: ">", color: "#4a5060" }
    }
  }

  // 7. Starling murmuration — autumn/winter dusk, undulating blob in sky
  if (options.murmuration) {
    const { x: mx, y: my, seed: ms } = options.murmuration
    const murCount = 18 + Math.floor(width * 0.15)
    for (let i = 0; i < murCount; i++) {
      const angle = (i / murCount) * Math.PI * 2 + ms * 0.08
      const rx = Math.floor(mx + Math.cos(angle) * (6 + hash(i * 7 + ms + 11113) % 8) + (hash(i * 11 + ms * 3 + 22221) % 5) - 2)
      const ry = Math.floor(my + Math.sin(angle) * 2 + (hash(i * 13 + ms + 33331) % 3) - 1)
      if (rx >= 0 && rx < width && ry >= 0 && ry < SKY_ROWS - 1)
        buffer[ry]![rx] = { char: "·", color: "#2a3040" }
    }
  }

  // 7. Kestrel — hovers stationary with fanned tail `⊢`, dashes between hovering spots
  if (options.kestrel) {
    const { x: kx, y: ky } = options.kestrel
    if (kx >= 0 && kx < width && ky >= 0 && ky < SKY_ROWS)
      buffer[ky]![kx] = { char: "⊢", color: "#c87030" }
  }

  // 7e. Bats — dusk/night, fly right-to-left with erratic altitude; echolocation rings
  if (period === "night" || period === "dusk") {
    for (const bat of options.bats ?? []) {
      if (bat.y >= 0 && bat.y < SKY_ROWS && bat.x >= 0 && bat.x < width) {
        buffer[bat.y]![bat.x] = { char: "\\", color: "#6a5448" }
        // Echolocation pulse — `))` ring ahead of bat
        const ex = bat.x - 2
        if (ex >= 0 && !buffer[bat.y]![ex]?.color)
          buffer[bat.y]![ex] = { char: ")", color: "#4a4050" }
        if (ex - 1 >= 0 && !buffer[bat.y]![ex - 1]?.color)
          buffer[bat.y]![ex - 1] = { char: ")", color: "#38303c" }
      }
    }
  }

  // 7f. Hawk — solitary soaring raptor during day, slow crossing at high altitude
  if (options.hawk && options.hawk.x >= 0 && options.hawk.x < width) {
    buffer[0]![options.hawk.x] = { char: "^", color: "#4a3a28" }
  }

  // Buzzard — circles slowly on thermals in mid-sky; broad wings = W silhouette
  if (options.buzzard && options.buzzard.x >= 0 && options.buzzard.x < width && options.buzzard.y >= 0 && options.buzzard.y < SKY_ROWS - 1) {
    buffer[options.buzzard.y]![options.buzzard.x] = { char: "W", color: "#6a5030" }
  }

  // Red kite — chestnut-red forked-tail raptor; lazy thermal soarer; =∧= wing shape
  if (options.redKite && options.redKite.x >= 1 && options.redKite.x < width - 1) {
    const { x: rkx, y: rky } = options.redKite
    if (rky >= 0 && rky < SKY_ROWS) {
      buffer[rky]![rkx] = { char: "∧", color: "#c05820" }
      buffer[rky]![rkx - 1] = { char: "=", color: "#c05820" }
      buffer[rky]![rkx + 1] = { char: "=", color: "#c05820" }
    }
  }

  // Peregrine falcon — fastest living creature; stoops vertically like a dark bullet; `!` trail
  if (options.peregrine && options.peregrine.x >= 0 && options.peregrine.x < width) {
    const { x: px, y: py } = options.peregrine
    if (py >= 0 && py < buffer.length)
      buffer[py]![px] = { char: "!", color: "#2a3848" }
    for (let trail = 1; trail <= 2; trail++) {
      const ty = py - trail
      if (ty >= 0 && ty < SKY_ROWS && !buffer[ty]![px]?.color)
        buffer[ty]![px] = { char: "·", color: lerpColor("#2a3848", getSkyColor(ty, period, blend), trail * 0.4) }
    }
  }

  // Dipper — stocky stream bird, bobs rhythmically on rocks; walks underwater for invertebrates
  if (options.dipper && options.dipper.x >= 0 && options.dipper.x < width) {
    const { x: dx, bobbing } = options.dipper
    // During bobbing: drop one row (crouching); otherwise: stand tall on rock
    const dy = bobbing ? groundStart : groundStart - 1
    if (dy < buffer.length)
      buffer[dy]![dx] = { char: "⊓", color: "#2a3830" }
    // White bib flash when upright
    if (!bobbing && dx + 1 < width && !buffer[dy]![dx + 1]?.color)
      buffer[dy]![dx + 1] = { char: "·", color: "#e8e8e0" }
  }

  // Bullfinch — stocky finch; male bright rose-red breast; winter visitor to berry-laden hedges
  if (options.bullfinch && options.bullfinch.x >= 0 && options.bullfinch.x < width) {
    const bfx = options.bullfinch.x
    if (!buffer[undergrowthY]![bfx]?.color)
      buffer[undergrowthY]![bfx] = { char: "◦", color: "#d82040" }
  }

  // Fieldfares/Redwings — Scandinavian winter thrushes; russet-grey flock in direct flight
  for (const ff of options.fieldfares ?? []) {
    if (ff.x < 0 || ff.x >= width) continue
    const ffy = Math.max(0, Math.min(SKY_ROWS - 1, ff.y))
    if (!buffer[ffy]![ff.x]?.color) buffer[ffy]![ff.x] = { char: "◦", color: "#9a7050" }
  }

  // Waxwings — Bohemian winter visitors; distinctive crest + red/yellow wing tips; canopy top
  for (const wx of options.waxwings ?? []) {
    if (wx.x < 0 || wx.x >= width) continue
    const wy = Math.max(0, Math.min(SKY_ROWS, wx.y))
    if (!buffer[wy]![wx.x]?.color) buffer[wy]![wx.x] = { char: "◈", color: "#d84828" }
  }

  // Swallows — fast aerial hunters at canopy level; spring/summer; forked tail `>` shape
  for (const s of options.swallows ?? []) {
    if (s.x < 0 || s.x >= width) continue
    const sy = Math.max(0, Math.min(buffer.length - 1, s.y))
    if (!buffer[sy]![s.x]?.color) buffer[sy]![s.x] = { char: ">", color: "#3060a0" }
  }

  // Raven — largest corvid; soars high in winter sky; \V/ wingspan, glossy blue-black
  if (options.raven && options.raven.x >= 1 && options.raven.x < width - 1) {
    const { x: rx, y: ry } = options.raven
    if (ry >= 0 && ry < SKY_ROWS) {
      buffer[ry]![rx] = { char: "V", color: "#1a1828" }
      buffer[ry]![rx - 1] = { char: "\\", color: "#1a1828" }
      buffer[ry]![rx + 1] = { char: "/", color: "#1a1828" }
    }
  }

  // Sparrowhawk — explosive low dash through tree canopy; barred wings ≈ blur
  if (options.sparrowhawk && options.sparrowhawk.x >= 0 && options.sparrowhawk.x < width) {
    const { x: shx, y: shy, leftward: shl } = options.sparrowhawk
    if (shy >= 0 && shy < buffer.length)
      buffer[shy]![shx] = { char: shl ? "<" : ">", color: "#6878a0" }
    const trail1 = shl ? shx + 1 : shx - 1
    const trail2 = shl ? shx + 2 : shx - 2
    if (trail1 >= 0 && trail1 < width && shy >= 0 && shy < buffer.length)
      buffer[shy]![trail1] = { char: "-", color: "#506070" }
    if (trail2 >= 0 && trail2 < width && shy >= 0 && shy < buffer.length && !buffer[shy]![trail2]?.color)
      buffer[shy]![trail2] = { char: "·", color: "#404858" }
  }

  // 7g. Heron — stands motionless at stream edge fishing (T silhouette)
  if (options.heron && options.heron.x >= 0 && options.heron.x < width) {
    const hx = options.heron.x
    buffer[undergrowthY]![hx] = { char: "T", color: "#8898a8" }
    if (groundStart < buffer.length && hx < width) {
      buffer[groundStart]![hx] = { char: "|", color: "#7a8898" }
    }
  }

  // 7g2. Woodpecker — taps on tree trunk during day, pecking animation
  if (options.woodpecker) {
    const { x: wx, y: wy, peck } = options.woodpecker
    if (wy >= 0 && wy < buffer.length && wx >= 0 && wx < width) {
      buffer[wy]![wx] = { char: peck ? "!" : "|", color: "#c03018" }
    }
  }

  // 7h. Dragonfly — summer, iridescent dart near water
  if (options.dragonfly) {
    const { x: dx, y: dy } = options.dragonfly
    if (dy >= SKY_ROWS && dy < groundStart && dx >= 0 && dx < width) {
      buffer[dy]![dx] = { char: "=", color: "#28c8b8" }
    }
  }

  // Damselfly — slender spring/summer near stream; blue/violet, thinner than dragonfly
  if ((season === "spring" || season === "summer") && period === "day" && forest.trees.length >= 10) {
    const seed8 = options.twinkleSeed ?? 0
    const dfX = streamX + hash(seed8 * 17 + 55551) % streamW
    const dfY = groundStart - 2 + hash(seed8 * 11 + 44443) % 2
    const dfColors = ["#4060e0", "#8030d0", "#40a0e0"]
    if (dfX >= 0 && dfX < width && dfY >= SKY_ROWS && dfY < groundStart && !buffer[dfY]![dfX]?.color)
      buffer[dfY]![dfX] = { char: "|", color: dfColors[hash(seed8 * 7 + 33337) % dfColors.length]! }
  }

  // Cuckoo call — spring, rising `♩` musical notes from hidden cuckoo in canopy
  if (season === "spring" && period === "day" && forest.trees.length >= 5) {
    const seed9 = options.twinkleSeed ?? 0
    const cuckooPhase = seed9 % 120 // cuckoo calls every ~2 min at 250ms tick = every 480 ticks ≈ every 30s visible
    if (cuckooPhase >= 0 && cuckooPhase < 4) {
      const cxTree = forest.trees[hash(forest.trees.length * 7 + 11117) % forest.trees.length]!
      const noteX = cxTree.x
      const noteY = SKY_ROWS - 1 - (cuckooPhase % 3)
      if (noteY >= 0 && noteX >= 0 && noteX < width && !buffer[noteY]![noteX]?.color)
        buffer[noteY]![noteX] = { char: "♩", color: "#c8a030" }
    }
  }

  // Ivy berries — small black berries on ivy-covered trees in winter
  if (season === "winter" && forest.trees.length >= 10) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.8 || tree.type === "stump") continue
      if (hash(tree.id * 53 + 77771) % 4 !== 0) continue // same as ivy trees
      const berryX = tree.x - 2
      if (berryX < 0 || berryX >= width) continue
      for (let y = groundStart - 3; y < groundStart - 1; y++) {
        if (!buffer[y]![berryX]?.color) continue
        if (hash(berryX * 31 + y * 17 + 44443) % 3 === 0)
          buffer[y]![berryX] = { char: "·", color: "#181818" } // black ivy berry
      }
    }
  }

  // 7b. Lightning bolt + sky flash during thunderstorm
  if (options.isLightning) {
    const boltX = hash((options.twinkleSeed ?? 0) * 53 + 22222) % width
    // Full sky flash — electrified white-yellow tint
    for (let y = 0; y < SKY_ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const cell = buffer[y]![x]!
        if (!cell.color) continue
        const dist = Math.abs(x - boltX)
        const flashStrength = Math.max(0, 1 - dist / (width * 0.35))
        if (flashStrength > 0.1)
          buffer[y]![x] = { char: cell.char, color: lerpColor(cell.color, "#fffff0", flashStrength * 0.6) }
      }
    }
    for (let y = 0; y < SKY_ROWS; y++) {
      buffer[y]![boltX] = { char: y === SKY_ROWS - 1 ? "!" : "|", color: y === 0 ? "#ffffff" : "#ffffa0" }
    }
    if (boltX + 1 < width) buffer[0]![boltX + 1] = { char: "·", color: "#ffffcc" }
  }

  // 7a. Spiderwebs — form between nearby trees at dawn, gone in wind/rain
  if (period === "dawn" && !options.isRaining && (options.windStrength ?? 0) < 2) {
    const sorted = [...forest.trees].sort((a, b) => a.x - b.x)
    for (let i = 0; i < sorted.length - 1; i++) {
      const tA = sorted[i]!, tB = sorted[i + 1]!
      const gap = tB.x - tA.x
      if (gap < 5 || gap > 13) continue
      const webY = SKY_ROWS  // just at the treeline
      for (let x = tA.x + 2; x <= tB.x - 2; x++) {
        if (buffer[webY]![x]?.color !== null) continue
        const isMid = x === Math.floor((tA.x + tB.x) / 2)
        buffer[webY]![x] = { char: isMid ? "·" : "-", color: "#6a7a9a" }
      }
    }
  }

  // Vole — tiny, fast ground prey, `›` in dark grey-brown, year-round
  if (options.vole && options.vole.x >= 0 && options.vole.x < width) {
    buffer[undergrowthY]![options.vole.x] = { char: "›", color: "#6a5040" }
  }

  // Hedgehog — nocturnal insectivore; ʘ snuffling, ● rolled into ball when alarmed
  if (options.hedgehog) {
    const hx = options.hedgehog.x
    if (hx >= 1 && hx < width) {
      buffer[undergrowthY]![hx] = { char: options.hedgehog.rolled ? "●" : "ʘ", color: "#7a5830" }
      if (!options.hedgehog.rolled && hx - 1 >= 0)
        buffer[undergrowthY]![hx - 1] = { char: "·", color: "#6a4820" }
    }
  }

  // 7b. Rabbit — fast dawn sprinter along undergrowth row
  for (const rabbit of options.rabbits ?? []) {
    const ry = groundStart - 1
    if (rabbit.x >= 1 && rabbit.x < width) {
      buffer[ry]![rabbit.x] = { char: ">", color: "#b8aa90" }
      buffer[ry]![rabbit.x - 1] = { char: "·", color: "#a09880" }
    }
  }

  // Hare — long-legged, sits bolt upright when alarmed; bolts at speed; winter coat paler
  if (options.hare) {
    const { x: hx, frozen, leftward } = options.hare
    if (hx >= 0 && hx < width) {
      const hareColor = season === "winter" ? "#c0b898" : "#c8902a"
      buffer[undergrowthY]![hx] = { char: frozen ? "ı" : (leftward ? "≺" : "≻"), color: hareColor }
    }
  }

  // 7b2. Squirrel — dash-pause-dash along undergrowth; autumn pauses = nut burying (v dig)
  if (options.squirrel && options.squirrel.x >= 1 && options.squirrel.x < width) {
    const sx = options.squirrel.x
    const isBurying = season === "autumn" && hash(sx * 13 + (options.twinkleSeed ?? 0) * 7 + 22229) % 4 === 0
    buffer[undergrowthY]![sx] = { char: isBurying ? "v" : ">", color: "#c09040" }
    buffer[undergrowthY]![sx - 1] = { char: isBurying ? "·" : "ø", color: "#d0a850" }
  }

  // Weasel — fastest ground animal, turns ermine-white in winter
  if (options.weasel && options.weasel.x >= 0 && options.weasel.x < width) {
    const { x: wx, y: wy } = options.weasel
    const weaselColor = season === "winter" ? "#e8e8d8" : "#c8a060"
    if (wy >= 0 && wy < buffer.length) buffer[wy]![wx] = { char: ">", color: weaselColor }
    if (wx - 1 >= 0 && wy >= 0) buffer[wy]![wx - 1] = { char: "-", color: weaselColor }
  }

  // Frog — appears near stream after rain, small green o
  if (options.frog && options.frog.x >= 0 && options.frog.x < width) {
    buffer[undergrowthY]![options.frog.x] = { char: "o", color: "#4a8828" }
  }

  // Wren — tiny fast undergrowth bird; `ω` with cocked tail (when paused)
  if (options.wren && options.wren.x >= 0 && options.wren.x < width) {
    buffer[undergrowthY]![options.wren.x] = { char: "ω", color: "#9a7848" }
  }

  // Toad migration — spring evening, parade of `o` toads crossing ground
  if (options.toadMigration && options.toadMigration.length > 0) {
    for (const toad of options.toadMigration) {
      if (toad.x < 0 || toad.x >= width) continue
      buffer[undergrowthY]![toad.x] = { char: "o", color: "#607040" } // darker than frog
    }
  }

  // Adder/grass snake — sinuous basking in sun; coiled `⊂⊃` or moving `~` in undergrowth
  if (options.snake && options.snake.x >= 0 && options.snake.x < width) {
    const sx = options.snake.x
    if (options.snake.basking) {
      // Coiled — concentric loops
      buffer[undergrowthY]![sx] = { char: "⊂", color: "#6a7840" }
      if (sx + 1 < width) buffer[undergrowthY]![sx + 1] = { char: "⊃", color: "#588030" }
    } else {
      // Moving — sinuous wave
      buffer[undergrowthY]![sx] = { char: "~", color: "#7a8848" }
      if (sx - 1 >= 0 && !buffer[undergrowthY]![sx - 1]?.color)
        buffer[undergrowthY]![sx - 1] = { char: "~", color: "#6a7840" }
    }
  }

  // Bumblebee — fat yellow-black pollinator hovering near flowers; spring-summer
  if ((season === "spring" || season === "summer") && period === "day" && forest.trees.length >= 5) {
    const seed7 = options.twinkleSeed ?? 0
    for (let x = 2; x < width - 2; x++) {
      // Appear near wildflowers (where undergrowthY has color from wildflowers/bracken)
      if (hash(x * 61 + seed7 * 13 + 33339) % 50 !== 0) continue
      const flowerCell = buffer[undergrowthY]![x]
      if (!flowerCell?.color) continue
      const beeY = undergrowthY - 1
      if (beeY < SKY_ROWS || buffer[beeY]![x]?.color) continue
      const beePhase = (seed7 + x * 3) % 10
      if (beePhase < 8) // hover most of the time
        buffer[beeY]![x] = { char: "⊕", color: "#d8b820" } // yellow with black bands
    }
  }

  // Goldfinch — yellow-red finch; `◈` when paused on seed head, `>` when moving
  if (options.goldfinch && options.goldfinch.x >= 0 && options.goldfinch.x < width) {
    const gfx = options.goldfinch.x
    buffer[undergrowthY]![gfx] = { char: options.goldfinch.paused ? "◈" : ">", color: "#e8c820" }
    if (gfx > 0) buffer[undergrowthY]![gfx - 1] = { char: "·", color: "#c83020" } // red face flash
  }

  // Pine marten — rare fast arboreal predator; dark brown flash in lower canopy
  if (options.pineMarten && options.pineMarten.x >= 0 && options.pineMarten.x < width) {
    const { x: pmx, y: pmy } = options.pineMarten
    if (pmy >= 0 && pmy < buffer.length)
      buffer[pmy]![pmx] = { char: options.pineMarten.x > (width / 2) ? "<" : ">", color: "#7a4818" }
  }

  // Pheasant — large colorful ground bird; flushed = jumps to sky row
  if (options.pheasant && options.pheasant.x >= 0 && options.pheasant.x < width) {
    const px = options.pheasant.x
    const py = options.pheasant.flushed ? SKY_ROWS + 1 : undergrowthY
    if (px < width && py >= 0 && py < buffer.length) {
      buffer[py]![px] = { char: options.pheasant.flushed ? "^" : ">", color: "#c04820" }
      if (px - 1 >= 0) buffer[py]![px - 1] = { char: options.pheasant.flushed ? "─" : "─", color: "#d8a020" }
      if (px + 1 < width && !options.pheasant.flushed) buffer[py]![px + 1] = { char: "~", color: "#a03818" }
    }
  }

  // Salamander — post-rain spring/summer; orange-red body + darker tail
  if (options.salamander && options.salamander.x >= 0 && options.salamander.x < width) {
    const sx = options.salamander.x
    buffer[undergrowthY]![sx] = { char: "◂", color: "#e04818" }
    if (sx + 1 < width && !buffer[undergrowthY]![sx + 1]?.color)
      buffer[undergrowthY]![sx + 1] = { char: "·", color: "#a83010" }
  }

  // Jay — autumn corvid with blue wing flash; hops along undergrowth, buries acorns
  if (options.jay && options.jay.x >= 0 && options.jay.x < width) {
    const jx = options.jay.x
    const jy = undergrowthY
    buffer[jy]![jx] = { char: options.jay.leftward ? "<" : ">", color: "#7088c0" }
    const acornX = options.jay.leftward ? jx + 1 : jx - 1
    if (acornX >= 0 && acornX < width)
      buffer[jy]![acornX] = { char: options.jay.carrying ? "○" : "·", color: "#c09838" }
  }

  // Raccoon — nocturnal stream visitor; washes food with ◉ when stopped
  if (options.raccoon) {
    const rx = options.raccoon.x
    const ry = groundStart - 1
    if (rx >= 1 && rx < width) {
      buffer[ry]![rx] = { char: options.raccoon.washing ? "◉" : ">", color: "#888880" }
      if (!options.raccoon.washing && rx - 1 >= 0) buffer[ry]![rx - 1] = { char: "~", color: "#787870" }
    }
  }

  // Fireflies — summer nights, blinking in the understory (lower tree rows)
  if (options.fireflies) {
    for (const ff of options.fireflies) {
      if (!ff.lit) continue
      if (ff.y >= SKY_ROWS + 3 && ff.y < SKY_ROWS + TREE_ROWS && ff.x >= 0 && ff.x < width) {
        if (!buffer[ff.y]![ff.x]?.color) {
          buffer[ff.y]![ff.x] = { char: "·", color: "#b8f040" }
        }
      }
    }
  }

  // Butterfly — spring/summer days, flutters through the understory
  if (options.butterfly) {
    const { x: bx, y: by, color: bcol } = options.butterfly
    if (by >= SKY_ROWS + 1 && by < SKY_ROWS + TREE_ROWS && bx >= 1 && bx < width - 1) {
      if (!buffer[by]![bx]?.color) buffer[by]![bx] = { char: "~", color: bcol }
    }
  }

  // Owl — nocturnal, perched on a branch in the mid-canopy
  if (options.owl) {
    const { x: ox, y: oy } = options.owl
    if (oy >= SKY_ROWS && oy < SKY_ROWS + TREE_ROWS - 1 && ox >= 0 && ox < width) {
      buffer[oy]![ox] = { char: "ô", color: "#7a6040" }
    }
  }

  // 7c. Deer — grazes at undergrowth level; autumn rut: Ψ antlers; spring: fawn follows
  if (options.deer) {
    const dy = groundStart - 1
    const dx = options.deer.x
    if (dx >= 1 && dx < width) {
      const isRut = season === "autumn"
      buffer[dy]![dx] = { char: isRut ? "Ψ" : "Y", color: isRut ? "#8a6a40" : "#9a7a50" }
      buffer[dy]![dx - 1] = { char: ":", color: "#8a6a40" }
      // Fawn in spring — tiny · following 3 cols behind mother
      if (season === "spring" && dx - 3 >= 0)
        buffer[dy]![dx - 3] = { char: "·", color: "#c0a870" }
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

  // Crows — autumn/winter ground scavengers, walk and peck
  if (options.crows) {
    const crowY = groundStart - 1
    for (const crow of options.crows) {
      if (crow.x >= 1 && crow.x < width) {
        buffer[crowY]![crow.x] = { char: crow.pecking ? "v" : ">", color: "#202820" }
        if (!crow.pecking && crow.x - 1 >= 0 && !buffer[crowY]![crow.x - 1]?.color) {
          buffer[crowY]![crow.x - 1] = { char: "-", color: "#2a3028" }
        }
      }
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

  // 7d2. Snow caps — top of each canopy column gets a solid white-blue cap in winter
  if (season === "winter") {
    for (let x = 0; x < width; x++) {
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        const cell = buffer[y]![x]
        if (cell?.color) {
          // Top of this canopy column — blend existing color toward snow white
          buffer[y]![x] = { char: "█", color: lerpColor(cell.color, "#d0e4f4", 0.75) }
          break
        }
      }
    }
  }

  // 7d2b. Golden hour — warm amber tint bleeds onto canopy tops at dawn/dusk
  if ((period === "dawn" && blend > 0.35) || (period === "dusk" && blend < 0.65)) {
    const warmStrength = period === "dawn" ? Math.min(1, (blend - 0.35) / 0.4) : Math.min(1, (0.65 - blend) / 0.4)
    if (warmStrength > 0) {
      for (let x = 0; x < width; x++) {
        for (let y = SKY_ROWS; y < groundStart - 2; y++) {
          const cell = buffer[y]![x]
          if (cell?.color) {
            buffer[y]![x] = { char: cell.char, color: lerpColor(cell.color, "#e87028", warmStrength * 0.45) }
            break
          }
        }
      }
    }
  }

  // 7d2c. Sunshafts through canopy gaps — bright warm column reaching ground in empty canopy lanes
  if (period === "day" && !options.isRaining && forest.trees.length >= 8) {
    for (let x = 2; x < width - 2; x++) {
      // Find columns with no canopy cells at all
      let hasCanopy = false
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        if (buffer[y]![x]?.color) { hasCanopy = true; break }
      }
      if (!hasCanopy && hash(x * 37 + forest.trees.length * 7 + 44441) % 5 === 0) {
        // Shaft: warm pale light on ground row
        const shaftColor = lerpColor(biome.ground[0]!, "#f0d898", 0.3)
        buffer[groundStart]![x] = { char: buffer[groundStart]![x]!.char, color: shaftColor }
        if (!buffer[groundStart - 1]![x]?.color)
          buffer[groundStart - 1]![x] = { char: "·", color: "#f8e8b0" }
      }
    }
  }

  // 7d3. Canopy sway — top 1–2 tree rows shift 1px in wind, driven by twinkle seed oscillation
  if (options.windStrength && options.windStrength >= 1) {
    const seed = options.twinkleSeed ?? 0
    const sway = Math.sin(seed * 0.6) > 0 ? 1 : -1
    const swayRows = options.windStrength === 2 ? 2 : 1
    for (let dy = 0; dy < swayRows; dy++) {
      const y = SKY_ROWS + dy
      if (y >= buffer.length) continue
      const row = buffer[y]!
      const filled: { x: number; cell: { char: string; color: string | null } }[] = []
      for (let x = 0; x < width; x++) {
        if (row[x]!.color !== null) {
          filled.push({ x, cell: { ...row[x]! } })
          row[x] = { char: "█", color: getSkyColor(y, period, blend) }
        }
      }
      for (const { x, cell } of filled) {
        const nx = Math.max(0, Math.min(width - 1, x + sway))
        if (!row[nx]!.color) row[nx] = cell
      }
    }
  }

  // Canopy shadow dappling — ground darkens in patches under developed trees (day only)
  if (period === "day" && !options.isRaining) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.5) continue
      const shadowRadius = Math.max(1, Math.floor(tree.growth * 3))
      for (let dx = -shadowRadius; dx <= shadowRadius; dx++) {
        const sx = tree.x + dx
        if (sx < 0 || sx >= width) continue
        const h = hash(sx * 37 + tree.id * 113 + 9999)
        if (h % 3 !== 0) continue  // ~33% coverage = dappled, not solid
        buffer[groundStart]![sx] = { char: "░", color: lerpColor(biome.ground[0]!, "#0a1808", 0.35) }
      }
    }
  }

  // Earthworm casts — post-rain, worms surface and leave small coil mounds on ground
  if (options.postRain && season !== "winter") {
    for (let x = 0; x < width; x++) {
      if (hash(x * 47 + 22229) % 9 === 0 && buffer[groundStart]![x]?.char === "█")
        buffer[groundStart]![x] = { char: "∙", color: lerpColor(biome.ground[0]!, "#5a3818", 0.45) }
    }
  }

  // Leaf litter accumulation — autumn/winter dried leaves carpet the ground
  {
    const lm = now.getMonth()
    let litterDensity = 0
    let litterColors: string[] = []
    if (lm === 9) { litterDensity = 8; litterColors = ["#c06830", "#d07820", "#a05020"] } // Oct
    else if (lm === 10) { litterDensity = 5; litterColors = ["#a85820", "#b06828", "#884818"] } // Nov
    else if (lm === 11 || lm === 0) { litterDensity = 10; litterColors = ["#704820", "#604018", "#583818"] } // Dec-Jan
    else if (lm === 1 || lm === 2) { litterDensity = 14; litterColors = ["#604018", "#503810", "#504020"] } // Feb-Mar
    if (litterDensity > 0 && forest.trees.length >= 5) {
      for (let x = 0; x < width; x++) {
        if (hash(x * 71 + 88887) % litterDensity !== 0) continue
        const gCell = buffer[groundStart]![x]
        if (!gCell?.color && gCell?.char === "█") {
          const col = litterColors[hash(x * 29 + 33331) % litterColors.length]!
          buffer[groundStart]![x] = { char: ["◦", "·", "∙"][hash(x * 53 + 77773) % 3]!, color: col }
        }
      }
    }
  }

  // 8a. Undergrowth — sparse details between tree trunks
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

  // Early spring bud burst — late winter/early spring, pale green · at bare branch tips
  if (season === "winter" || season === "spring") {
    const m = now.getMonth()
    const isBudSeason = m === 2 || m === 3  // March and April
    if (isBudSeason) {
      for (const tree of forest.trees) {
        if (tree.type === "stump" || tree.growth < 0.5) continue
        const budX1 = tree.x - 1; const budX2 = tree.x + 1
        for (const bx of [budX1, budX2]) {
          if (bx < 0 || bx >= width) continue
          for (let y = SKY_ROWS; y < SKY_ROWS + 2; y++) {
            const cell = buffer[y]![bx]
            if (cell?.color && hash(bx * 29 + tree.id * 17 + 66667) % 3 === 0)
              buffer[y]![bx] = { char: "·", color: lerpColor(cell.color, "#90d040", 0.55) }
          }
        }
      }
    }
  }

  // Wildflowers — spring/summer undergrowth; colourful ✿/◦ dots between tree trunks
  if ((season === "spring" || season === "summer") && forest.trees.length >= 5) {
    const flowerColors = ["#e060a0", "#e0c030", "#a060d0", "#50b0e0", "#e04050", "#f0e040"]
    for (let x = 0; x < width; x++) {
      if (hash(x * 83 + forest.trees.length * 11 + 55559) % 12 !== 0) continue
      if (buffer[undergrowthY]![x]?.color) continue
      const col = flowerColors[hash(x * 31 + 44441) % flowerColors.length]!
      const char = hash(x * 67 + 33337) % 3 === 0 ? "✿" : "◦"
      buffer[undergrowthY]![x] = { char, color: col }
    }
  }

  // Rabbit warrens — dark earth burrow holes near ground edges in established forests
  if (forest.trees.length >= 10) {
    const warrens = [Math.floor(width * 0.12), Math.floor(width * 0.78)]
    for (const wx of warrens) {
      for (let dx = 0; dx <= 1; dx++) {
        const hx = wx + dx * 3
        if (hx < 0 || hx >= width) continue
        if (!buffer[groundStart]![hx]?.color)
          buffer[groundStart]![hx] = { char: "○", color: "#3a2810" }
      }
    }
  }

  // Tree sap — amber drip on lightning-scarred trunks in spring/summer
  if (options.lightningScars && (season === "spring" || season === "summer")) {
    for (const scar of options.lightningScars) {
      const tx = scar.x
      if (tx < 0 || tx >= width) continue
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        if (buffer[y]![tx]?.char === "█") {
          const sapY = y + 1
          if (sapY < groundStart && !buffer[sapY]![tx]?.color)
            buffer[sapY]![tx] = { char: "│", color: "#c88020" }
          break
        }
      }
    }
  }

  // Mole hills — small soil mounds on ground, appear after rain or overnight
  if (options.moleHills && options.moleHills.length > 0) {
    for (const mx of options.moleHills) {
      if (mx < 1 || mx >= width - 1) continue
      buffer[groundStart]![mx] = { char: "∧", color: lerpColor(biome.ground[0]!, "#8a6040", 0.4) }
      if (!buffer[groundStart - 1]![mx]?.color)
        buffer[groundStart - 1]![mx] = { char: "·", color: lerpColor(biome.ground[0]!, "#7a5030", 0.5) }
    }
  }

  // Lichen patches — ancient forest floors, slow colonizers on bare ground
  if (forest.trees.length >= 30) {
    for (let x = 0; x < width; x++) {
      if (buffer[groundStart]![x]?.char === "█" && hash(x * 53 + forest.trees.length * 11 + 44449) % 9 === 0)
        buffer[groundStart]![x] = { char: "≋", color: lerpColor(biome.ground[0]!, "#7a9858", 0.4) }
    }
  }

  // Deep shade ferns — grow under dense canopy in damp seasons (spring/summer/autumn)
  if (season !== "winter" && forest.trees.length >= 12) {
    for (let x = 0; x < width; x++) {
      if (buffer[undergrowthY]![x]?.color) continue
      let canopyRows = 0
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        if (buffer[y]![x]?.color) canopyRows++
      }
      if (canopyRows >= 3 && hash(x * 41 + forest.trees.length * 7 + 22223) % 4 === 0)
        buffer[undergrowthY]![x] = { char: "∇", color: "#2a5020" }
    }
  }

  // Fallen fruit — summer/autumn under fruit-bearing species, `○` drops on ground
  if (season === "summer" || season === "autumn") {
    const fruitSpecies: Record<string, string> = { cherry: "#c01828", apple: "#c83820", olive: "#6a7820", ginkgo: "#c8a820" }
    for (const tree of forest.trees) {
      const fruitColor = fruitSpecies[tree.type]
      if (!fruitColor || tree.growth < 0.7) continue
      for (let dx = -3; dx <= 3; dx++) {
        const fx = tree.x + dx
        if (fx < 0 || fx >= width) continue
        if (hash(fx * 29 + tree.id * 11 + 55553) % 9 === 0 && !buffer[undergrowthY]![fx]?.color)
          buffer[undergrowthY]![fx] = { char: "○", color: fruitColor }
      }
    }
  }

  // Surface roots — very old full-growth trees (growth=1, ancient forest), `─` on ground level
  if (forest.trees.length >= 50) {
    for (const tree of forest.trees) {
      if (tree.growth < 1.0 || tree.type === "stump") continue
      if (hash(tree.id * 43 + 77773) % 6 !== 0) continue
      for (let dx = 1; dx <= 3; dx++) {
        const rx = tree.x + dx
        if (rx >= width) break
        if (buffer[undergrowthY]![rx]?.color) break
        buffer[undergrowthY]![rx] = { char: "─", color: lerpColor(biome.ground[0]!, "#5a3818", 0.4) }
      }
    }
  }

  // Wild garlic — late spring (April-May), white star blooms in shaded damp undergrowth
  if (season === "spring" && forest.trees.length >= 8) {
    const m = now.getMonth()
    const isGarlicTime = m >= 3 && m <= 4  // April-May
    if (isGarlicTime) {
      // Dense carpet near stream bank where damp soil suits garlic
      for (let dx = -6; dx <= 6; dx++) {
        const gx = streamX + dx
        if (gx < 0 || gx >= width) continue
        if (!buffer[undergrowthY]![gx]?.color && hash(gx * 37 + 88883) % 3 === 0)
          buffer[undergrowthY]![gx] = { char: "∗", color: "#e8f0e0" }
      }
      // Scattered under tree canopy
      for (let x = 0; x < width; x++) {
        if (buffer[undergrowthY]![x]?.color) continue
        let canopyAbove = 0
        for (let y = SKY_ROWS; y < groundStart - 1; y++) { if (buffer[y]![x]?.color) canopyAbove++ }
        if (canopyAbove >= 2 && hash(x * 41 + forest.trees.length * 19 + 88883) % 9 === 0)
          buffer[undergrowthY]![x] = { char: "∗", color: "#e8f0e0" }
      }
    }
  }

  // Wildflowers — spring/summer, scattered colored blooms in undergrowth
  if (season === "spring" || season === "summer") {
    const springPalette = ["#e870b8", "#f8d030", "#70c8f8", "#e8e070"] as const
    const summerPalette = ["#f09030", "#ffffff", "#f8f040", "#40d0a0"] as const
    const palette = season === "spring" ? springPalette : summerPalette
    for (let x = 0; x < width; x++) {
      if (buffer[undergrowthY]![x]?.color !== null) continue
      const h = hash(x * 97 + forest.trees.length * 31 + 55555)
      if (h % 7 !== 0) continue
      buffer[undergrowthY]![x] = { char: h % 4 === 0 ? "*" : "·", color: palette[h % palette.length]! }
    }
  }

  // Bee cluster — pollinators hovering above flowering patches, spring/summer
  if ((season === "spring" || season === "summer") && forest.trees.length >= 5 && !options.isRaining) {
    const seedB = options.twinkleSeed ?? 0
    const beeCount = 2 + hash(seedB * 11 + 33331) % 3
    for (let i = 0; i < beeCount; i++) {
      const h = hash(i * 31 + seedB * 17 + 77773)
      const bx = (h % (width - 4)) + 2
      const by = groundStart - 2 - (h % 2)
      if (by < SKY_ROWS || by >= groundStart) continue
      if (!buffer[by]![bx]?.color)
        buffer[by]![bx] = { char: "·", color: "#d8a820" }
    }
  }

  // Fairy ring — permanent mushroom circle, unlocked after 3+ rain events
  // Glows blue-green at night (bioluminescence)
  const isNightTime = period === "night" || period === "dusk"
  if (options.fairyRingX !== undefined) {
    const rx = options.fairyRingX
    const ry = groundStart - 1
    const ringColor = isNightTime ? "#30d870" : "#8a3a2a"
    const ring = [-3, -1, 1, 3] as const
    for (const dx of ring) {
      const fx = rx + dx
      if (fx >= 0 && fx < width) {
        buffer[ry]![fx] = { char: "♦", color: isNightTime ? lerpColor(ringColor, "#20a850", dx % 2 === 0 ? 0 : 0.4) : (dx % 2 === 0 ? "#8a3a2a" : "#c45020") }
      }
    }
    if (rx >= 0 && rx < width) buffer[groundStart]![rx] = { char: "○", color: isNightTime ? "#28b848" : "#4a6030" }
  }

  // Post-rain: puddles on ground + mushrooms in undergrowth
  if (options.postRain) {
    for (let x = 0; x < width; x++) {
      const h = hash(x * 59 + 8888)
      if (h % 7 === 0) {
        buffer[groundStart]![x] = { char: "~", color: "#3a6a8a" }
      }
      if (h % 11 === 0 && buffer[undergrowthY]![x]?.color === null) {
        const mushroomColors = isNightTime
          ? ["#28b848", "#30d060", "#20a840"] as const
          : ["#8a3a2a", "#c4521a", "#e8782a"] as const
        buffer[undergrowthY]![x] = { char: "♦", color: mushroomColors[h % 3]! }
      }
    }
  }

  // Post-rain canopy drip — drops fall from canopy edges into understory
  if (options.postRain) {
    const seed = options.twinkleSeed ?? 0
    for (let x = 0; x < width; x++) {
      for (let y = SKY_ROWS + 1; y < groundStart - 1; y++) {
        if (!buffer[y]![x]?.color && buffer[y - 1]![x]?.color) {
          if (hash(x * 19 + seed * 11 + 77771) % 6 === 0)
            buffer[y]![x] = { char: "'", color: "#5898b8" }
          break
        }
      }
    }
  }

  // Stump moss + age rings — green cap + concentric rings on cut face
  for (const tree of forest.trees) {
    if (tree.type !== "stump") continue
    for (let y = SKY_ROWS; y < groundStart; y++) {
      if (buffer[y]![tree.x]?.color) {
        const mossY = y - 1
        if (mossY >= SKY_ROWS && !buffer[mossY]![tree.x]?.color)
          buffer[mossY]![tree.x] = { char: "░", color: "#4a7828" }
        // Age ring on left face of stump (shows cross-section rings)
        const ringX = tree.x - 1
        if (ringX >= 0 && buffer[y]![ringX]?.char === "█") {
          const ringChar = hash(tree.id * 37 + y * 13 + 11117) % 2 === 0 ? "⊙" : "·"
          buffer[y]![ringX] = { char: ringChar, color: lerpColor(buffer[y]![ringX]!.color ?? "#6a3818", "#c8a070", 0.5) }
        }
        break
      }
    }
  }

  // Spring catkins — birch and willow dangle pale yellow-green °/∘ below canopy
  if (season === "spring") {
    for (const tree of forest.trees) {
      if (tree.type !== "birch" && tree.type !== "willow") continue
      if (tree.growth < 0.6) continue
      for (let y = SKY_ROWS; y < groundStart - 2; y++) {
        if (buffer[y]![tree.x]?.color && !buffer[y + 1]![tree.x]?.color) {
          for (let dx = -1; dx <= 1; dx++) {
            const cx = tree.x + dx
            if (cx < 0 || cx >= width) continue
            if (!buffer[y + 1]![cx]?.color && hash(cx * 23 + tree.id * 7 + 33337) % 3 === 0)
              buffer[y + 1]![cx] = { char: "°", color: "#b8c850" }
          }
          break
        }
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

  // Dandelion seeds — spring, ∘ wisps drifting high through the sky, animated
  if (season === "spring" && forest.trees.length >= 5 && !options.isRaining) {
    const seed = options.twinkleSeed ?? 0
    const count = Math.max(2, Math.floor(width * 0.03))
    for (let i = 0; i < count; i++) {
      const h = hash(i * 71 + seed * 43 + 33339)
      const x = (hash(i * 71 + 33331) + Math.floor(seed * 0.3)) % width
      const y = 1 + (h % (SKY_ROWS - 2))
      if (buffer[y]![x]?.color !== null) continue
      buffer[y]![x] = { char: "∘", color: lerpColor("#e8e8c0", "#f0f0d8", (h % 10) / 10) }
    }
  }

  // Autumn falling leaves — mid-air descent animated by twinkle seed
  if (season === "autumn" && !options.isRaining) {
    const seed = options.twinkleSeed ?? 0
    const windDrift = (options.windStrength ?? 0) + 1
    const count = Math.max(3, Math.floor(width * 0.05))
    for (let i = 0; i < count; i++) {
      const baseX = hash(i * 97 + 66666) % width
      const baseY = hash(i * 97 + 77777) % (TREE_ROWS - 1)
      const y = SKY_ROWS + (baseY + seed) % TREE_ROWS
      const x = (baseX + Math.floor(seed * windDrift * 0.4)) % width
      if (y >= SKY_ROWS + TREE_ROWS) continue
      if (buffer[y]![x]?.color !== null) continue
      const leafColors = ["#c4701a", "#e8a020", "#d45010", "#b85010"] as const
      buffer[y]![x] = { char: "·", color: leafColors[hash(i * 97 + 66666) % 4]! }
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

  // 8c. Butterflies — spring/summer, drift in upper canopy
  if (season === "spring" || season === "summer") {
    const seed = options.twinkleSeed ?? 0
    const count = Math.max(2, Math.floor(width * 0.04))
    for (let i = 0; i < count; i++) {
      const h = hash(i * 67 + seed * 89 + 7777)
      const x = h % width
      const y = SKY_ROWS + (hash(h + 3) % Math.floor(TREE_ROWS * 0.55))
      if (buffer[y]![x]?.color !== null) continue
      const springColors = ["#f870c0", "#e050a0", "#ffb0d8"] as const
      const summerColors = ["#f8c020", "#e0a018", "#ffd060"] as const
      const palette = season === "spring" ? springColors : summerColors
      buffer[y]![x] = { char: "~", color: palette[h % 3]! }
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

  // Cicadas — summer afternoons, ∫ vibration in tree trunks, animated pulse
  if (season === "summer" && (period === "day" || (period === "dusk" && blend < 0.5))) {
    const seed = options.twinkleSeed ?? 0
    for (const tree of forest.trees) {
      if (tree.growth < 0.7) continue
      if (hash(tree.id * 47 + seed * 13 + 55559) % 4 !== 0) continue
      const cicY = groundStart - 3 - (hash(tree.id * 23 + 11117) % 2)
      if (cicY < SKY_ROWS || cicY >= groundStart) continue
      const cx = tree.x + (hash(tree.id * 31 + 22229) % 2 === 0 ? 1 : -1)
      if (cx < 0 || cx >= width) continue
      if (!buffer[cicY]![cx]?.color)
        buffer[cicY]![cx] = { char: "∫", color: "#7a6030" }
    }
  }

  // Moths — night only, pale cream specks drawn to moonlight in upper canopy
  if (period === "night") {
    const seed = options.twinkleSeed ?? 0
    const count = Math.max(2, Math.floor(width * 0.04))
    for (let i = 0; i < count; i++) {
      const h = hash(i * 59 + seed * 103 + 9876)
      const x = h % width
      const y = SKY_ROWS + (hash(h + 17) % Math.floor(TREE_ROWS * 0.65))
      if (buffer[y]![x]?.color !== null) continue
      const colors = ["#d8d0c0", "#c8c0b0", "#e8e0d0"] as const
      buffer[y]![x] = { char: "·", color: colors[h % 3]! }
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

  // Evening mist — purple-grey ground fog at dusk, hugs the forest floor
  if (period === "dusk" && blend > 0.3) {
    const mistDensity = Math.max(3, Math.round(7 * (1 - blend) + 3))
    const mistStart = groundStart - 2
    for (let y = mistStart; y < groundStart + GROUND_ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const h = hash(x * 41 + y * 73 + 88888)
        if (h % mistDensity !== 0) continue
        buffer[y]![x] = { char: h % 3 === 0 ? "▒" : "░", color: "#8a7a9a" }
      }
    }
  }

  // Morning frost — autumn/winter dawn, ice crystals on the ground
  if (period === "dawn" && (season === "winter" || season === "autumn")) {
    const frostDensity = season === "winter" ? 4 : 7
    for (let x = 0; x < width; x++) {
      const cell = buffer[groundStart]![x]
      if (cell?.char !== "█" && cell?.char !== "░") continue  // only bare ground
      if (hash(x * 61 + 44440) % frostDensity !== 0) continue
      buffer[groundStart]![x] = { char: "·", color: "#c0d4e0" }
    }
  }

  // Snowfall — winter, animated drifting flakes across sky and canopy
  if (season === "winter" && !options.isRaining) {
    const seed = options.twinkleSeed ?? 0
    const flakeCount = Math.max(5, Math.floor(width * 0.07))
    for (let i = 0; i < flakeCount; i++) {
      const h = hash(i * 43 + seed * 71 + 11111)
      const x = (h + seed * 2) % width
      const y = hash(h + seed * 5 + 7) % (SKY_ROWS + TREE_ROWS - 1)
      const intensity = h % 4
      if (intensity === 0) continue  // skip ~25% for sparseness
      buffer[y]![x] = { char: intensity === 3 ? "*" : "·", color: intensity === 3 ? "#e8eef4" : "#c0ccd8" }
    }
  }

  // Valley fog — cold air pools at ground level on autumn/winter nights
  if ((season === "winter" || season === "autumn") && (period === "night" || (period === "dusk" && blend > 0.6))) {
    const fogDensity = season === "winter" ? 3 : 5
    for (let x = 0; x < width; x++) {
      const h = hash(x * 53 + 55555)
      if (h % fogDensity !== 0) continue
      if (buffer[undergrowthY]![x]?.color === null) {
        buffer[undergrowthY]![x] = { char: h % 3 === 0 ? "▒" : "░", color: "#7a8898" }
      }
    }
  }

  // 8e. Fog (wilt)
  applyFog(buffer, effectiveWilt, width)

  // 8f. Wildfire — smoke → burning → ember → ash
  if (options.wildfire) {
    const { x: fx, width: fw, stage, seed } = options.wildfire
    for (let dx = -4; dx < fw + 4; dx++) {
      const cx = fx + dx
      if (cx < 0 || cx >= width) continue
      const inCore = dx >= 0 && dx < fw
      const h = hash(cx * 37 + seed * 19 + 44441)

      if (stage === "smoke") {
        // Pre-fire: grey smoke wisps in sky above zone, no flames yet
        if (!inCore) continue
        const smokeY = h % (SKY_ROWS - 2) + 1
        if (!buffer[smokeY]![cx]?.color)
          buffer[smokeY]![cx] = { char: "░", color: "#606868" }

      } else if (stage === "burning") {
        // Sky glow — warm orange tints bottom 2 sky rows above fire
        for (let y = SKY_ROWS - 2; y < SKY_ROWS; y++) {
          buffer[y]![cx] = { char: "█", color: lerpColor(getSkyColor(y, period, blend), "#d03808", inCore ? 0.55 : 0.2) }
        }
        if (inCore) {
          // Fire over tree and undergrowth rows
          for (let y = SKY_ROWS; y < groundStart; y++) {
            const t = (y - SKY_ROWS) / TREE_ROWS
            const flicker = (h + y) % 3
            const fireColor = lerpColor("#ffe060", "#d02008", Math.min(1, t + flicker * 0.08))
            const fireChar = y === SKY_ROWS ? "▲" : flicker === 0 ? "|" : flicker === 1 ? "!" : "▲"
            buffer[y]![cx] = { char: fireChar, color: fireColor }
          }
          buffer[groundStart]![cx] = { char: "█", color: "#1a0c06" }
        }
        // Smoke drifting up from fire and around it
        if (h % 4 !== 0) {
          const smokeY = h % (SKY_ROWS - 1)
          if (!buffer[smokeY]![cx]?.color || buffer[smokeY]![cx]!.char === "█")
            buffer[smokeY]![cx] = { char: h % 2 === 0 ? "░" : "▒", color: "#585858" }
        }

      } else if (stage === "ember") {
        if (!inCore) continue
        // Charred trunk silhouettes in dark brown
        for (let y = SKY_ROWS; y < groundStart - 1; y++) {
          if (buffer[y]![cx]?.color) {
            buffer[y]![cx] = { char: "|", color: "#2e1a0e" }
            break
          }
        }
        // Sparse glowing embers on undergrowth
        if (h % 4 === 0)
          buffer[groundStart - 1]![cx] = { char: "·", color: lerpColor("#c02808", "#e06018", (h >> 4) % 2 === 0 ? 0 : 1) }
        buffer[groundStart]![cx] = { char: "█", color: "#1a0c06" }
        // Faint residual smoke
        if (h % 7 === 0 && !buffer[1]![cx]?.color)
          buffer[1]![cx] = { char: "░", color: "#4a4848" }

      } else if (stage === "ash") {
        if (!inCore) continue
        // Charred skeleton — topmost tree cell per column becomes a stump char
        for (let y = SKY_ROWS; y < groundStart - 1; y++) {
          if (buffer[y]![cx]?.color) {
            buffer[y]![cx] = { char: "|", color: "#3a2a1e" }
            break
          }
        }
        // Ash-covered ground
        buffer[groundStart]![cx] = { char: h % 4 === 0 ? "░" : "█", color: "#2e2218" }
      }
    }
  }

  // 8f2. Post-fire regeneration — bright green pioneer sprouts in ash zone
  if (options.wildfire && options.wildfire.stage === "ash") {
    const { x: pfx, width: pfw, seed: pfs } = options.wildfire
    for (let dx = 0; dx < pfw; dx++) {
      const cx = pfx + dx
      if (cx < 0 || cx >= width) continue
      const h = hash(cx * 43 + pfs * 7 + 55557)
      if (h % 5 === 0)
        buffer[groundStart - 1]![cx] = { char: "·", color: lerpColor("#40a820", "#80d040", (h % 10) / 10) }
    }
  }

  // 8g. Bark beetle infestation — dead crown dieback, gallery bore marks
  if (options.beetles && options.beetles.zones.length > 0) {
    const { zones, intensity } = options.beetles
    for (const { x: zx, radius: zr } of zones) {
      for (let cx = zx - zr; cx <= zx + zr; cx++) {
        if (cx < 0 || cx >= width) continue
        // Dead crown: upper canopy rows tinted to dry grey-brown
        const crownDepth = Math.ceil(TREE_ROWS * 0.45)
        for (let y = SKY_ROWS; y < SKY_ROWS + crownDepth; y++) {
          const cell = buffer[y]![cx]
          if (!cell?.color) continue
          const relDepth = (y - SKY_ROWS) / crownDepth
          const tint = intensity * (1 - relDepth * 0.4)
          buffer[y]![cx] = { char: cell.char, color: lerpColor(cell.color, "#7a5a28", Math.min(0.9, tint * 0.85)) }
        }
        // Bore gallery marks on mid-trunk at higher intensity
        if (intensity > 0.45) {
          const midY = SKY_ROWS + Math.floor(TREE_ROWS * 0.55)
          const h = hash(cx * 41 + 99997)
          if (h % 3 === 0) {
            const cell = buffer[midY]![cx]
            if (cell?.color) buffer[midY]![cx] = { char: "·", color: lerpColor("#7a5a28", "#3a2810", intensity) }
          }
        }
      }
    }
  }

  // 8h. Drought — cracked earth, dried stream, heat haze
  if (options.drought && options.drought.intensity > 0) {
    const dri = options.drought.intensity
    // Cracked ground — overwrite ground tiles with dry earth pattern
    for (let x = 0; x < width; x++) {
      const h = hash(x * 59 + 77771)
      const crackChars = ["╌", "·", " ", "╌", "·", "·", " ", "╌"]
      const crackChar = crackChars[h % crackChars.length]!
      const groundColor = lerpColor("#6a5840", "#9a8060", (h % 16) / 16)
      if (dri > 0.3) {
        buffer[groundStart]![x] = { char: crackChar, color: lerpColor("#6a5840", groundColor, dri) }
      }
    }
    // Dried stream bed — sandy/rocky when drought peaks
    if (dri > 0.5 && forest.trees.length >= 10) {
      for (let i = 0; i < streamW; i++) {
        const sx = streamX + i
        if (sx < 0 || sx >= width) continue
        const h = hash(sx * 71 + 88881)
        const bedChars = ["_", ".", "─", "_", ".", " ", "_"]
        buffer[groundStart + 1]![sx] = { char: bedChars[h % bedChars.length]!, color: lerpColor("#7a6850", "#a08060", dri) }
      }
    }
    // Heat haze — warm yellowish tint on bottom sky row
    for (let x = 0; x < width; x++) {
      const hazeY = SKY_ROWS - 1
      const cell = buffer[hazeY]![x]
      if (cell && !cell.color) continue
      const h = hash(x * 83 + 11119)
      if (h % 5 < 2) {
        const hazeColor = lerpColor(getSkyColor(hazeY, period, blend), "#c8a040", dri * 0.35)
        buffer[hazeY]![x] = { char: "░", color: hazeColor }
      }
    }
  }

  // 8i. Storm blowdown — snapped trunks lying horizontal, debris scattered
  if (options.blowdown && options.blowdown.fallen.length > 0) {
    const { seed: bseed, fallen } = options.blowdown
    for (const { x: fx, dir } of fallen) {
      // Snapped trunk stub at base
      const stubY = groundStart - 1
      if (buffer[stubY]![fx]?.color) buffer[stubY]![fx] = { char: "╷", color: "#5a3820" }
      // Horizontal trunk lying on ground, stretching 5-9 cols in dir
      const trunkLen = 5 + (hash(fx * 71 + bseed + 33331) % 5)
      for (let i = 1; i <= trunkLen; i++) {
        const tx = fx + i * dir
        if (tx < 0 || tx >= width) continue
        buffer[groundStart]![tx] = { char: "─", color: lerpColor("#5a3820", "#4a2810", i / trunkLen) }
      }
      // Scattered leaf debris around fallen tree
      for (let di = -2; di <= trunkLen + 2; di++) {
        const dx = fx + di * dir
        if (dx < 0 || dx >= width) continue
        const dh = hash(dx * 53 + fx * 19 + bseed + 55551)
        if (dh % 5 === 0) {
          const debrisY = groundStart - 1
          if (!buffer[debrisY]![dx]?.color || buffer[debrisY]![dx]!.char === " ")
            buffer[debrisY]![dx] = { char: dh % 2 === 0 ? "·" : "·", color: "#7a6040" }
        }
      }
    }
    // Horizontal rain streaks — sky rows only to avoid mid-forest blue band
    for (let y = 1; y < SKY_ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const h = hash(x * 37 + y * 83 + bseed * 17 + 66661)
        if (h % 7 === 0 && !buffer[y]![x]?.color) {
          buffer[y]![x] = { char: "╌", color: "#5888a8" }
        }
      }
    }
  }

  // 8j. Blight / fungal outbreak — mushroom clusters, infected canopy, spore drift
  if (options.blight && options.blight.zones.length > 0) {
    const { zones, intensity, seed: bseed } = options.blight
    for (const zx of zones) {
      // Mushroom clusters at trunk base (undergrowth row)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = zx + dx
        if (cx < 0 || cx >= width) continue
        const h = hash(cx * 67 + bseed + 22221)
        if (h % 3 === 0) {
          const mushroomY = groundStart - 1
          const mushroomColors = ["#c06880", "#9a5060", "#d07890"]
          buffer[mushroomY]![cx] = { char: "♠", color: mushroomColors[h % mushroomColors.length]! }
        }
      }
      // Infected canopy — sickly purple-grey spots on leaves
      if (intensity > 0.3) {
        for (let y = SKY_ROWS; y < groundStart - 2; y++) {
          for (let dx = -3; dx <= 3; dx++) {
            const cx = zx + dx
            if (cx < 0 || cx >= width) continue
            const cell = buffer[y]![cx]
            if (!cell?.color) continue
            const h = hash(cx * 43 + y * 71 + bseed + 33331)
            if (h % 4 === 0) {
              buffer[y]![cx] = { char: cell.char, color: lerpColor(cell.color, "#8868a0", intensity * 0.75) }
            }
          }
        }
      }
    }
    // Spore drift — fine dots drifting up from zone centers through tree rows
    if (intensity > 0.5) {
      for (const zx of zones) {
        for (let y = SKY_ROWS; y < groundStart; y++) {
          const sx = zx + Math.round(Math.sin(y * 0.7 + bseed * 0.01) * 3)
          if (sx < 0 || sx >= width) continue
          const h = hash(sx * 31 + y * 97 + bseed + 44441)
          if (h % 7 === 0 && !buffer[y]![sx]?.color) {
            buffer[y]![sx] = { char: "·", color: lerpColor("#a080c0", "#d0a0d8", intensity) }
          }
        }
      }
    }
  }

  // 8k. Hard frost event — crystalline rime on canopy edges, ice needles on undergrowth
  if (options.frost && options.frost.intensity > 0) {
    const { intensity: fri, seed: fseed } = options.frost
    // Rime crystals — tint exposed canopy edges toward icy blue-white
    for (let x = 0; x < width; x++) {
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        const cell = buffer[y]![x]
        if (!cell?.color) continue
        // Check if cell above is empty (exposed canopy top)
        const above = y > 0 ? buffer[y - 1]![x] : null
        const exposed = !above?.color
        if (!exposed) continue
        const h = hash(x * 53 + y * 31 + fseed + 77771)
        if (h % 3 < Math.ceil(fri * 3)) {
          buffer[y]![x] = { char: cell.char, color: lerpColor(cell.color, "#c8dff0", fri * 0.85) }
        }
      }
    }
    // Ice needles on undergrowth row
    for (let x = 0; x < width; x++) {
      const h = hash(x * 79 + fseed + 88881)
      if (h % 3 === 0) {
        const needleY = groundStart - 1
        const existingCell = buffer[needleY]![x]
        if (!existingCell?.color) {
          buffer[needleY]![x] = { char: h % 2 === 0 ? "|" : "╷", color: lerpColor("#a0c8e0", "#d8eef8", (h & 15) / 15) }
        }
      }
    }
    // Sparkle on ground — tiny glints
    for (let x = 0; x < width; x++) {
      const h = hash(x * 61 + fseed + 99991)
      if (h % 5 === 0) {
        buffer[groundStart]![x] = { char: "·", color: lerpColor("#8ab0c8", "#d0e8f8", fri) }
      }
    }
  }

  // 8l. Lightning scars — char burn mark on struck trees, glows faintly at night
  if (options.lightningScars && options.lightningScars.length > 0) {
    for (const { x: sx } of options.lightningScars) {
      if (sx < 0 || sx >= width) continue
      // Find topmost occupied canopy cell in scar column
      let scarY = -1
      for (let y = SKY_ROWS; y < groundStart - 1; y++) {
        if (buffer[y]![sx]?.color) { scarY = y; break }
      }
      if (scarY >= 0) {
        const glowColor = (period === "night" || period === "dusk") ? "#c04010" : "#6a3010"
        buffer[scarY]![sx] = { char: "↯", color: glowColor }
        // Char streak down trunk below scar
        for (let y = scarY + 1; y < Math.min(scarY + 3, groundStart - 1); y++) {
          if (buffer[y]![sx]?.color)
            buffer[y]![sx] = { char: "│", color: lerpColor("#6a3010", "#3a1808", (y - scarY) / 3) }
        }
      }
    }
  }

  // 8m. Falling autumn leaves — drift diagonally through canopy rows
  if (options.fallingLeaves && options.fallingLeaves.length > 0) {
    for (const { x, y, color, char } of options.fallingLeaves) {
      if (x < 0 || x >= width || y < SKY_ROWS || y >= groundStart) continue
      if (!buffer[y]![x]?.color) buffer[y]![x] = { char, color }
    }
  }

  // 8n. Post-rain mushrooms — small caps on ground, various earthy colors
  if (options.groundMushrooms && options.groundMushrooms.length > 0) {
    const mushroomColors = ["#a05828", "#8a3820", "#c07040", "#7a4828", "#b86838"]
    for (const mx of options.groundMushrooms) {
      if (mx < 0 || mx >= width) continue
      const h = hash(mx * 67 + 55553)
      const capColor = mushroomColors[h % mushroomColors.length]!
      // Cap on undergrowth row
      if (!buffer[groundStart - 1]![mx]?.color)
        buffer[groundStart - 1]![mx] = { char: "∩", color: capColor }
    }
  }

  // Song thrush anvil — spring, smashed snail shells beside a stone; `◎` anvil + `·` debris
  if (season === "spring" && forest.trees.length >= 6) {
    const anvilSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const ax = Math.floor(width * 0.3 + hash(anvilSeed * 11 + 22223) % Math.floor(width * 0.4))
    if (!buffer[undergrowthY]![ax]?.color) buffer[undergrowthY]![ax] = { char: "◎", color: "#7a6848" }
    for (let di = 1; di <= 3; di++) {
      const sx = ax + di
      if (sx < width && !buffer[undergrowthY]![sx]?.color) buffer[undergrowthY]![sx] = { char: "·", color: "#a89070" }
    }
  }

  // Deer rut — October, two stags contest territory; `><` clash symbol between nearby trees
  if (season === "autumn" && now.getMonth() === 9 && forest.trees.length >= 10) {
    const largeTrees = forest.trees.filter(t => t.growth >= 0.8 && t.type !== "stump")
    for (let i = 0; i < largeTrees.length - 1; i++) {
      const ta = largeTrees[i]!
      const tb = largeTrees[i + 1]!
      const gap = tb.x - ta.x
      if (gap < 6 || gap > 14) continue
      const mid = Math.floor((ta.x + tb.x) / 2)
      if (mid >= 0 && mid < width - 1 && !buffer[undergrowthY]![mid]?.color) {
        buffer[undergrowthY]![mid] = { char: ">", color: "#8a5020" }
        buffer[undergrowthY]![mid + 1] = { char: "<", color: "#8a5020" }
      }
      break // only one clash at a time
    }
  }

  // Marsh marigold — bright golden-yellow spring flowers at stream edge; April-May
  if (season === "spring" && forest.trees.length >= 8) {
    const m = now.getMonth()
    if (m >= 2 && m <= 4) {
      for (let dx = -3; dx <= 3; dx++) {
        const mx = streamX + dx
        if (mx < 0 || mx >= width) continue
        if (!buffer[undergrowthY]![mx]?.color && hash(mx * 29 + forestSeed + 33337) % 3 === 0)
          buffer[undergrowthY]![mx] = { char: "✦", color: "#f0c020" }
      }
    }
  }

  // Bird nests — spring; small `⊃` cup nests in fork of mature tree canopy
  if (season === "spring" && forest.trees.length >= 5) {
    for (const tree of forest.trees) {
      if (tree.growth < 0.7 || tree.type === "stump") continue
      if (hash(tree.id * 67 + 44443) % 6 !== 0) continue // ~17% of mature trees
      const nestX = tree.x + 1
      const nestY = groundStart - 4
      if (nestX < width && nestY >= SKY_ROWS && !buffer[nestY]![nestX]?.color)
        buffer[nestY]![nestX] = { char: "⊃", color: "#8a6030" }
    }
  }

  // Gossamer silk — Indian summer, floating spider silk threads catch light in autumn tree rows
  if (season === "autumn" && (period === "dawn" || period === "day") && !options.isRaining && forest.trees.length >= 8) {
    const m = now.getMonth()
    if (m === 8 || m === 9) { // September-October warm spell
      const seed5 = options.twinkleSeed ?? 0
      for (let y = SKY_ROWS + 1; y < groundStart - 2; y++) {
        for (let x = 0; x < width; x++) {
          if (hash(x * 71 + y * 43 + seed5 * 13 + 11117) % 22 !== 0) continue
          if (!buffer[y]![x]?.color)
            buffer[y]![x] = { char: "─", color: lerpColor("#c8d0b8", "#e8e8d0", (x * 13 + y * 7) % 10 / 10) }
        }
      }
    }
  }

  // Mycorrhizal network — "wood wide web"; faint `·` connections between tree roots in autumn
  if (season === "autumn" && forest.trees.length >= 10) {
    const sortedTrees = [...forest.trees].filter(t => t.growth >= 0.5 && t.type !== "stump").sort((a, b) => a.x - b.x)
    for (let i = 0; i < sortedTrees.length - 1; i++) {
      const ta = sortedTrees[i]!
      const tb = sortedTrees[i + 1]!
      if (tb.x - ta.x > 12) continue // only nearby trees connected
      for (let x = ta.x + 1; x < tb.x; x++) {
        if (hash(x * 61 + ta.id * 37 + 99991) % 4 !== 0) continue
        if (!buffer[groundStart]![x]?.color)
          buffer[groundStart]![x] = { char: "·", color: "#8a5028" }
      }
    }
  }

  // Oak mast — autumn bumper acorn crop; `◦` acorns on ground under oak trees
  if (season === "autumn" && forest.trees.length >= 5) {
    for (const tree of forest.trees) {
      if (tree.type !== "oak" || tree.growth < 0.6) continue
      for (let dx = -5; dx <= 5; dx++) {
        const ax = tree.x + dx
        if (ax < 0 || ax >= width) continue
        if (hash(ax * 47 + tree.id * 23 + 99997) % 4 !== 0) continue
        if (!buffer[groundStart]![ax]?.color)
          buffer[groundStart]![ax] = { char: "◦", color: "#7a5820" }
      }
    }
  }

  // Puffball mushrooms — autumn open grass; round white spheres, burst black when ripe
  if (season === "autumn" && forest.trees.length >= 6) {
    const puffSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const m = now.getMonth()
    for (let i = 0; i < 3; i++) {
      const px = Math.floor(hash(puffSeed * 7 + i * 23 + 77771) % width)
      let canopyAbove = 0
      for (let y = SKY_ROWS; y < groundStart - 1; y++) { if (buffer[y]![px]?.color) canopyAbove++ }
      if (canopyAbove > 0) continue // only in open areas
      const isRipe = m >= 10 && hash(px * 31 + puffSeed + 33331) % 3 === 0
      if (!buffer[undergrowthY]![px]?.color)
        buffer[undergrowthY]![px] = { char: "○", color: isRipe ? "#3a2818" : "#e8e0d0" }
    }
  }

  // 8o. Morning dew — sparkle dots on bare undergrowth patches at dawn
  if (options.morningDew) {
    for (let x = 0; x < width; x++) {
      const h = hash(x * 83 + 44443)
      if (h % 5 === 0) {
        const dewY = groundStart - 1
        if (!buffer[dewY]![x]?.color)
          buffer[dewY]![x] = { char: "·", color: lerpColor("#88c0d8", "#c0e4f0", (h & 15) / 15) }
      }
    }
  }

  // 8p. Spring pollen drift — light yellow motes drifting through canopy
  if (options.pollenDrift && options.pollenDrift.length > 0) {
    const pollenColors = ["#e8dc60", "#f0e880", "#d8d048", "#f4f0a0"]
    for (const { x, y } of options.pollenDrift) {
      if (x < 0 || x >= width || y < 0 || y >= groundStart) continue
      if (!buffer[y]![x]?.color) {
        const h = hash(x * 41 + y * 83 + 11113)
        buffer[y]![x] = { char: "·", color: pollenColors[h % pollenColors.length]! }
      }
    }
  }

  // 8q. Spider webs — dawn/dusk, horizontal spans between trees in upper canopy
  if (options.spiderWebs && options.spiderWebs.length > 0) {
    for (const { x: wx, span } of options.spiderWebs) {
      const webY = SKY_ROWS + 1
      for (let i = 0; i < span; i++) {
        const cx = wx + i
        if (cx < 0 || cx >= width) continue
        const cell = buffer[webY]![cx]
        if (cell?.color) continue
        const webChar = i === 0 || i === span - 1 ? "·" : i % 3 === 1 ? "╌" : "─"
        buffer[webY]![cx] = { char: webChar, color: lerpColor("#a0b0b8", "#d0dce4", i / span) }
      }
      // Dew on web strand
      const midX = wx + Math.floor(span / 2)
      if (midX >= 0 && midX < width && !buffer[webY]![midX]?.color)
        buffer[webY]![midX] = { char: "◦", color: "#c8e8f8" }
    }
  }

  // 8r. Snail — slow ground mover with slime trail, post-rain
  if (options.snail) {
    const { x: sx } = options.snail
    const snailY = groundStart - 1
    if (sx >= 1 && sx < width) {
      buffer[snailY]![sx] = { char: "ə", color: "#9a8870" }
      if (sx > 1 && !buffer[snailY]![sx - 1]?.color)
        buffer[snailY]![sx - 1] = { char: "·", color: "#7a9898" }
    }
  }

  // Slug — post-rain, even slower than snail; glistening silver-grey body + slime trail
  if (options.slug) {
    const { x: slx } = options.slug
    const slugY = groundStart - 1
    if (slx >= 0 && slx < width) {
      buffer[slugY]![slx] = { char: "◁", color: "#708878" } // dark grey-green body
      // Slime trail — shiny silver trail behind slug
      for (let tx = Math.max(0, slx - 3); tx < slx; tx++) {
        if (!buffer[slugY]![tx]?.color)
          buffer[slugY]![tx] = { char: "·", color: "#90b8b0" } // iridescent slime
      }
    }
  }

  // 8s. Caterpillar — multi-segment incher on undergrowth in spring
  if (options.caterpillar) {
    const { segments, dir } = options.caterpillar
    const catY = groundStart - 1
    const catColors = ["#5a9030", "#4a8020", "#6aa040"]
    segments.forEach((x, i) => {
      if (x < 0 || x >= width) return
      const isHead = i === 0
      const isTail = i === segments.length - 1
      const char = isHead ? (dir > 0 ? "D" : "q") : isTail ? "·" : "∘"
      const color = catColors[i % catColors.length]!
      if (!buffer[catY]![x]?.color) buffer[catY]![x] = { char, color }
    })
  }

  // 8t. Otter — swims through stream, dives occasionally
  if (options.otter && forest.trees.length >= 10) {
    const ox = options.otter.x
    const otterY = groundStart + 1
    if (ox >= streamX && ox < streamX + streamW && ox >= 0 && ox < width) {
      if (!options.otter.diving) {
        buffer[otterY]![ox] = { char: "o", color: "#7a5030" }
        if (ox + 1 < width) buffer[otterY]![ox + 1] = { char: "o", color: "#6a4028" }
      } else {
        buffer[otterY]![ox] = { char: "~", color: "#4888a8" }
      }
    }
  }

  // 8u. Berry clusters — low shrub berries on undergrowth in summer/autumn
  if (options.berries && options.berries.length > 0) {
    for (const { x: bx, color: bc } of options.berries) {
      if (bx < 0 || bx >= width) continue
      const berryY = groundStart - 1
      if (!buffer[berryY]![bx]?.color)
        buffer[berryY]![bx] = { char: "●", color: bc }
    }
  }

  // 8v. Moss patches — damp ground cover, slightly green-tinted soil chars
  if (options.mossPatch) {
    for (let x = 0; x < width; x++) {
      const h = hash(x * 79 + 33337)
      if (h % 7 === 0 && !buffer[groundStart]![x]?.color) {
        buffer[groundStart]![x] = { char: h % 2 === 0 ? "░" : "·", color: lerpColor("#4a6830", "#607840", (h & 15) / 15) }
      }
    }
  }

  // 8w. Seed drift — helicopter maple seeds, dandelion fluff drifting through mid-air
  if (options.seedDrift && options.seedDrift.length > 0) {
    for (const { x, y, char } of options.seedDrift) {
      if (x < 0 || x >= width || y < SKY_ROWS || y >= groundStart) continue
      if (!buffer[y]![x]?.color) buffer[y]![x] = { char, color: "#d0c890" }
    }
  }

  // 8x. Badger — nocturnal ground forager, stocky with white-grey stripe
  if (options.badger) {
    const { x: bx } = options.badger
    const badgerY = groundStart - 1
    if (bx >= 0 && bx < width - 1) {
      buffer[badgerY]![bx] = { char: "▄", color: "#505050" }
      if (bx + 1 < width) buffer[badgerY]![bx + 1] = { char: "▄", color: "#c8c8c0" }
    }
  }

  // 8y. Kingfisher — electric blue perched at stream edge, dives with orange flash
  if (options.kingfisher && forest.trees.length >= 10) {
    const { x: kx, diving } = options.kingfisher
    if (kx >= 0 && kx < width) {
      const perchY = groundStart - 1
      if (diving) {
        buffer[perchY]![kx] = { char: "↓", color: "#e07820" }
      } else {
        buffer[perchY]![kx] = { char: "◆", color: "#1880d8" }
      }
    }
  }

  // 8z. Wild boar — heavy autumn forager, stops to root
  if (options.boar) {
    const { x: bx, rooting } = options.boar
    const boarY = groundStart - 1
    if (bx >= 0 && bx < width - 2) {
      buffer[boarY]![bx] = { char: rooting ? "V" : "▶", color: "#6a4830" }
      if (bx + 1 < width) buffer[boarY]![bx + 1] = { char: rooting ? "v" : "▶", color: "#5a3820" }
      if (bx + 2 < width) buffer[boarY]![bx + 2] = { char: rooting ? "·" : "▶", color: "#4a2810" }
    }
  }

  // 8zc. Rain puddles — shallow reflective pools on ground after rain
  if (options.puddles && options.puddles.length > 0) {
    for (const px of options.puddles) {
      if (px < 0 || px >= width) continue
      const pudColor = lerpColor(biome.ground[0]!, "#4888a8", 0.55)
      buffer[groundStart]![px] = { char: "≈", color: pudColor }
      if (px + 1 < width) buffer[groundStart]![px + 1] = { char: "·", color: lerpColor(biome.ground[0]!, "#4888a8", 0.35) }
    }
  }

  // 8zb. Ground beetle — tiny fast insect on undergrowth
  if (options.beetle) {
    const bx = options.beetle.x
    const beetleY = groundStart - 1
    if (bx >= 0 && bx < width && !buffer[beetleY]![bx]?.color)
      buffer[beetleY]![bx] = { char: "∙", color: "#2a3820" }
  }

  // 8zf. Acorn/seed litter — autumn ground scatter near seed-bearing species
  if (season === "autumn" && forest.trees.length >= 8) {
    const litterSpecies = new Set(["oak", "maple", "cherry", "pine", "ginkgo", "beech"])
    const litterColors: Record<string, string> = { oak: "#6a4020", maple: "#8a3018", cherry: "#6a1830", pine: "#5a4020", ginkgo: "#c8a030", beech: "#5a3818" }
    for (const tree of forest.trees) {
      if (!litterSpecies.has(tree.type) || tree.growth < 0.5) continue
      const spread = 6
      for (let dx = -spread; dx <= spread; dx++) {
        const lx = tree.x + dx
        if (lx < 0 || lx >= width) continue
        if (hash(lx * 37 + tree.id * 19 + 66661) % 7 !== 0) continue
        if (!buffer[groundStart - 1]![lx]?.color)
          buffer[groundStart - 1]![lx] = { char: "◦", color: litterColors[tree.type] ?? "#6a4020" }
      }
    }
  }

  // Mistle thrush ("stormcock") — sings boldly from treetop in bad weather; ♪ notes in rain/wind
  if (options.isRaining && (options.windStrength ?? 0) >= 1 && forest.trees.length >= 5 && period !== "night") {
    const thrushSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const thrushTree = forest.trees[hash(thrushSeed * 13 + 77773) % forest.trees.length]!
    const tick = options.twinkleSeed ?? 0
    const noteChars = ["♪", "♫", "♩"]
    for (let i = 0; i < 3; i++) {
      const nx = thrushTree.x - 3 + i * 3
      const ny = SKY_ROWS + Math.floor((tick * 0.2 + i) % 3)
      if (nx >= 0 && nx < width && ny >= SKY_ROWS && ny < groundStart && !buffer[ny]![nx]?.color)
        buffer[ny]![nx] = { char: noteChars[i % noteChars.length]!, color: "#e0c080" }
    }
  }

  // Frost feathers — winter dawn, delicate crystal patterns on bare ground/undergrowth
  if (season === "winter" && (period === "dawn" || period === "night")) {
    const h2 = now.getHours()
    if (h2 < 9 || h2 >= 22) {
      for (let x = 0; x < width; x++) {
        if (hash(x * 67 + 55553) % 7 !== 0) continue
        const cell = buffer[undergrowthY]![x]
        if (!cell?.color)
          buffer[undergrowthY]![x] = { char: ["✦", "✧", "·"][hash(x * 41 + 33337) % 3]!, color: "#c8dce8" }
      }
    }
  }

  // Autumn leaves floating in stream — leaves drift downstream in October-November
  if (season === "autumn") {
    const lm = now.getMonth()
    if (lm >= 9 && lm <= 10) {
      const leafSeed = options.twinkleSeed ?? 0
      const leafColors = ["#c06830", "#a05020", "#d07820", "#885020"]
      for (let i = 0; i < 4; i++) {
        const lx = streamX + 1 + hash(i * 31 + leafSeed * 11 + 44441) % (streamW - 2)
        if (lx < 0 || lx >= width) continue
        const fy = groundStart + 1
        if (buffer[fy]![lx]?.char === "~" || buffer[fy]![lx]?.char === "≈")
          buffer[fy]![lx] = { char: "◦", color: leafColors[hash(lx * 17 + 33331) % leafColors.length]! }
      }
    }
  }

  // Conifer cone litter — autumn/winter, pine cones scattered under pines and araucaria
  if ((season === "autumn" || season === "winter") && forest.trees.length >= 5) {
    const conifers = ["pine", "araucaria", "eucalyptus"] as const
    for (const tree of forest.trees) {
      if (!conifers.some(t => tree.type === t) || tree.growth < 0.5) continue
      for (let dx = -5; dx <= 5; dx++) {
        const cx = tree.x + dx
        if (cx < 0 || cx >= width) continue
        if (hash(cx * 43 + tree.id * 29 + 77773) % 8 !== 0) continue
        if (!buffer[groundStart]![cx]?.color)
          buffer[groundStart]![cx] = { char: "●", color: "#6a4820" }
      }
    }
  }

  // Glow worm — summer nights, female glows green on ground to attract mate
  if (period === "night" && season === "summer" && forest.trees.length >= 10) {
    const seed4 = options.twinkleSeed ?? 0
    for (let x = 0; x < width; x++) {
      if (hash(x * 53 + 44449) % 25 !== 0) continue
      const glowPhase = (seed4 + x * 3) % 20
      if (glowPhase > 3) continue // blink slowly
      if (!buffer[undergrowthY]![x]?.color)
        buffer[undergrowthY]![x] = { char: "·", color: "#40e828" }
    }
  }

  // Deer hoof prints — winter ground after deer visits; split-hoof ∨ marks
  if (season === "winter" && options.deer) {
    const dx0 = options.deer.x
    for (let i = 0; i < 4; i++) {
      const px = dx0 - i * 4
      if (px < 0 || px >= width) continue
      if (!buffer[groundStart]![px]?.color)
        buffer[groundStart]![px] = { char: "∨", color: "#5a4030" }
    }
  }

  // 8zg. Ant trail — animated procession between two established trees, spring to autumn
  if (season !== "winter" && forest.trees.length >= 15) {
    const seed3 = options.twinkleSeed ?? 0
    const treeA = forest.trees[hash(forest.trees.length * 7 + 11113) % forest.trees.length]!
    const treeB = forest.trees[hash(forest.trees.length * 13 + 22221) % forest.trees.length]!
    if (treeA !== treeB) {
      const ax = Math.min(treeA.x, treeB.x)
      const bx = Math.max(treeA.x, treeB.x)
      const antY = groundStart - 1
      for (let x = ax; x <= bx; x++) {
        if (hash(x * 11 + seed3 * 7 + 55551) % 5 === 0) {
          if (!buffer[antY]![x]?.color)
            buffer[antY]![x] = { char: "·", color: "#3a2810" }
        }
      }
    }
  }

  // 8zd. Ground fog — low mist layer on cool mornings (spring/autumn), hugs ground rows
  if (options.groundFog) {
    for (let x = 0; x < width; x++) {
      const fh = hash(x * 43 + 55551)
      if (fh % 3 === 0) {
        const fogColor = lerpColor("#9098a8", "#c0c8d8", (fh % 10) / 10)
        if (!buffer[groundStart - 1]![x]?.color)
          buffer[groundStart - 1]![x] = { char: "░", color: fogColor }
      }
      if (fh % 5 === 0) {
        const fogColor2 = lerpColor("#8090a0", "#b0b8c8", (fh % 7) / 7)
        if (!buffer[groundStart]![x]?.color)
          buffer[groundStart]![x] = { char: "░", color: fogColor2 }
      }
    }
  }

  // 8ze. Moth — nocturnal pollinator, erratic dusk-to-dawn drifter
  if (options.moth) {
    const { x: mx, y: my, color: mc } = options.moth
    if (mx >= 0 && mx < width && my >= 0 && my < buffer.length)
      buffer[my]![mx] = { char: "◇", color: mc }
  }

  // 8za. Dawn chorus — musical notes float up from trees at early dawn
  if (options.dawnChorus && options.dawnChorus.length > 0) {
    const noteChars = ["♪", "♫", "♩"]
    for (const { x, y, life } of options.dawnChorus) {
      if (x < 0 || x >= width || y < 0 || y >= SKY_ROWS) continue
      const brightness = Math.min(1, life / 6)
      const noteColor = lerpColor("#907838", "#f0d060", brightness)
      const char = noteChars[Math.floor(x * 0.3 + y) % noteChars.length]!
      if (!buffer[y]![x]?.color) buffer[y]![x] = { char, color: noteColor }
    }
  }

  // 9. Output loop with season + wilt color composition
  const skyBottomColor = seasonTintColor(getSkyColor(SKY_ROWS - 1, period, blend), season)
  const lines: string[] = []
  for (let y = 0; y < SCENE_HEIGHT - SPACER_ROWS - STATS_ROWS - CTA_ROWS; y += 1) {
    let line = ""
    // Tree rows without content show sky continuation — seamless when forest is sparse
    const skyBg = y < SKY_ROWS
      ? seasonTintColor(getSkyColor(y, period, blend), season)
      : y < groundStart
        ? skyBottomColor
        : null
    for (const cell of buffer[y]!) {
      if (!cell.color) {
        // Empty cell: use sky background in sky+tree rows so no terminal-default holes
        if (skyBg !== null) {
          line += chalk.bgHex(skyBg)(" ")
        } else {
          line += cell.char
        }
      } else {
        let color = seasonTintColor(cell.color, season)
        if (effectiveWilt > 0 && y >= SKY_ROWS) color = wiltColor(color, effectiveWilt)
        if (skyBg !== null && cell.char !== "█") {
          line += chalk.bgHex(skyBg).hex(color)(cell.char)
        } else {
          line += chalk.hex(color)(cell.char)
        }
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

export function getStreamBounds(forest: Forest, termWidth: number): { x: number; w: number } | null {
  if (forest.trees.length < 10) return null
  const width = Math.max(40, termWidth)
  const createdSeed = forest.createdAt.slice(0, 10).split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
  const x = Math.floor(width * 0.15 + hash(createdSeed * 13 + 77) % Math.floor(width * 0.65))
  return { x, w: 14 + hash(x * 7 + 88) % 8 }
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
