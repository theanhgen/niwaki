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
  options: { twinkleSeed?: number; birds?: { x: number; y: number }[]; foxes?: { x: number }[]; rabbits?: { x: number }[]; shootingStarTrail?: { x: number; y: number }[]; deer?: { x: number }; fairyRingX?: number; milestoneText?: string; isRaining?: boolean; windStrength?: 0 | 1 | 2; postRain?: boolean; isLightning?: boolean; comet?: { x: number; y: number }; bearPrints?: number[]; bats?: { x: number; y: number }[]; hawk?: { x: number }; squirrel?: { x: number }; heron?: { x: number }; dragonfly?: { x: number; y: number }; streamFish?: { x: number; leftward: boolean }; woodpecker?: { x: number; y: number; peck: boolean }; weasel?: { x: number; y: number }; frog?: { x: number }; fireflies?: { x: number; y: number; lit: boolean }[]; owl?: { x: number; y: number }; butterfly?: { x: number; y: number; color: string }; clouds?: { x: number; y: number; width: number; density: 0|1|2 }[]; crows?: { x: number; pecking: boolean }[]; wildfire?: { x: number; width: number; stage: string; seed: number }; beetles?: { zones: { x: number; radius: number }[]; intensity: number }; drought?: { intensity: number }; blowdown?: { seed: number; fallen: { x: number; dir: 1 | -1 }[] }; blight?: { zones: number[]; intensity: number; seed: number }; frost?: { intensity: number; seed: number }; lightningScars?: { x: number }[]; fallingLeaves?: { x: number; y: number; color: string; char: string }[]; groundMushrooms?: number[]; morningDew?: boolean; pollenDrift?: { x: number; y: number }[]; spiderWebs?: { x: number; span: number }[]; snail?: { x: number }; caterpillar?: { segments: number[]; dir: 1 | -1 }; otter?: { x: number; diving: boolean }; berries?: { x: number; color: string }[]; mossPatch?: boolean; seedDrift?: { x: number; y: number; char: string }[]; badger?: { x: number }; kingfisher?: { x: number; diving: boolean }; boar?: { x: number; rooting: boolean }; dawnChorus?: { x: number; y: number; life: number }[]; beetle?: { x: number }; puddles?: number[]; groundFog?: boolean; moth?: { x: number; y: number; color: string } } = {},
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
    for (let i = 0; i < logW; i++) {
      const lx = logX + i
      if (lx < 0 || lx >= width) continue
      const lh = hash(lx * 41 + logSeed + 33333)
      const hasMoss = lh % 3 === 0
      const isBark = lh % 5 === 0
      const logColor = lerpColor("#5a3820", "#3a2010", i / logW)
      buffer[logY]![lx] = { char: hasMoss ? "░" : isBark ? "≡" : "─", color: hasMoss ? lerpColor(logColor, "#4a6828", 0.65) : logColor }
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

  // Winter snow on top ground row
  if (season === "winter") {
    for (let x = 0; x < width; x++) {
      const snowChar = hash(x * 13 + 77) % 3 === 0 ? "░" : "█"
      buffer[groundStart]![x] = { char: snowChar, color: lerpColor(biome.ground[0]!, "#c8d0d8", 0.6) }
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
    const createdSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const streamX = Math.floor(width * 0.15 + hash(createdSeed * 13 + 77) % Math.floor(width * 0.65))
    const streamW = 14 + hash(streamX * 7 + 88) % 8
    const seed = options.twinkleSeed ?? 0
    const streamColor = options.postRain ? "#5aaaca" : "#2a6a8a"
    for (let i = 0; i < streamW; i++) {
      const sx = streamX + i
      if (sx < 0 || sx >= width) continue
      if (season === "winter") {
        const isIce = hash(sx * 31 + 33333) % 2 === 0
        buffer[groundStart + 1]![sx] = isIce ? { char: "─", color: "#a8c0d0" } : { char: "~", color: "#3a5878" }
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
    const createdSeedM = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const mStreamX = Math.floor(width * 0.15 + hash(createdSeedM * 13 + 77) % Math.floor(width * 0.65))
    const mStreamW = 14 + hash(mStreamX * 7 + 88) % 8
    for (let i = 0; i < mStreamW; i++) {
      const sx = mStreamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 31 + 99991) % 3 === 0)
        buffer[groundStart]![sx] = { char: "░", color: lerpColor("#c0c8d0", "#a8b8c8", hash(sx * 17 + 44443) % 10 / 10) }
    }
  }

  // Rain splashes on stream — `·` drip rings when raining
  if (options.isRaining && forest.trees.length >= 10) {
    const createdSeed2 = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const sStreamX = Math.floor(width * 0.15 + hash(createdSeed2 * 13 + 77) % Math.floor(width * 0.65))
    const sStreamW = 14 + hash(sStreamX * 7 + 88) % 8
    const seed2 = options.twinkleSeed ?? 0
    for (let i = 0; i < sStreamW; i++) {
      const sx = sStreamX + i
      if (sx < 0 || sx >= width) continue
      if (hash(sx * 29 + seed2 * 17 + 88887) % 4 === 0)
        buffer[groundStart + 1]![sx] = { char: "·", color: "#8ab8d0" }
    }
  }

  // Stream fish — brief silver dart crossing the water
  if (options.streamFish) {
    const { x: fx, leftward } = options.streamFish
    const fy = groundStart + 1
    if (fx >= 0 && fx < width) {
      buffer[fy]![fx] = { char: leftward ? "<" : ">", color: "#80c0d0" }
      const tail = leftward ? fx + 1 : fx - 1
      if (tail >= 0 && tail < width) buffer[fy]![tail] = { char: leftward ? ">" : "<", color: "#60a0b0" }
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

  // 6b. Composite animal visitors
  for (const tree of forest.trees) {
    if (!tree.visitor) continue
    const treeSprite = getSprite(tree.type, tree.growth, tree.id % 3)
    const sideOffset = Math.floor(treeSprite.width / 2) + 2
    try {
      compositeSprite(buffer, getAnimalSprite(tree.visitor), tree.x + sideOffset, treeBaseY)
    } catch {}
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

  // 7. Birds
  for (const bird of options.birds ?? []) {
    if (bird.y >= 0 && bird.y < SKY_ROWS && bird.x >= 0 && bird.x < width) {
      buffer[bird.y]![bird.x] = { char: ">", color: "#7a7878" }
    }
  }

  // 7e. Bats — dusk/night, fly right-to-left with erratic altitude
  if (period === "night" || period === "dusk") {
    for (const bat of options.bats ?? []) {
      if (bat.y >= 0 && bat.y < SKY_ROWS && bat.x >= 0 && bat.x < width) {
        buffer[bat.y]![bat.x] = { char: "\\", color: "#6a5448" }
      }
    }
  }

  // 7f. Hawk — solitary soaring raptor during day, slow crossing at high altitude
  if (options.hawk && options.hawk.x >= 0 && options.hawk.x < width) {
    buffer[0]![options.hawk.x] = { char: "^", color: "#4a3a28" }
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

  // 7b. Lightning bolt in sky
  if (options.isLightning) {
    const boltX = hash((options.twinkleSeed ?? 0) * 53 + 22222) % width
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

  // 7b. Rabbit — fast dawn sprinter along undergrowth row
  for (const rabbit of options.rabbits ?? []) {
    const ry = groundStart - 1
    if (rabbit.x >= 1 && rabbit.x < width) {
      buffer[ry]![rabbit.x] = { char: ">", color: "#b8aa90" }
      buffer[ry]![rabbit.x - 1] = { char: "·", color: "#a09880" }
    }
  }

  // 7b2. Squirrel — dash-pause-dash along undergrowth, bushy ø tail
  if (options.squirrel && options.squirrel.x >= 1 && options.squirrel.x < width) {
    const sx = options.squirrel.x
    buffer[undergrowthY]![sx] = { char: ">", color: "#c09040" }
    buffer[undergrowthY]![sx - 1] = { char: "ø", color: "#d0a850" }
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

  // 7c. Deer — grazes at undergrowth level; autumn rut adds Ψ antler rack
  if (options.deer) {
    const dy = groundStart - 1
    const dx = options.deer.x
    if (dx >= 1 && dx < width) {
      const isRut = season === "autumn"
      buffer[dy]![dx] = { char: isRut ? "Ψ" : "Y", color: isRut ? "#8a6a40" : "#9a7a50" }
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

  // Stump moss — green cap on top of fallen stump sprites
  for (const tree of forest.trees) {
    if (tree.type !== "stump") continue
    for (let y = SKY_ROWS; y < groundStart; y++) {
      if (buffer[y]![tree.x]?.color) {
        const mossY = y - 1
        if (mossY >= SKY_ROWS && !buffer[mossY]![tree.x]?.color)
          buffer[mossY]![tree.x] = { char: "░", color: "#4a7828" }
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
      const createdSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      const streamX = Math.floor(width * 0.15 + hash(createdSeed * 13 + 77) % Math.floor(width * 0.65))
      const streamW = 14 + hash(streamX * 7 + 88) % 8
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
    const createdSeed = forest.createdAt.slice(0, 10).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    const streamX = Math.floor(width * 0.15 + hash(createdSeed * 13 + 77) % Math.floor(width * 0.65))
    const streamW = 14 + hash(streamX * 7 + 88) % 8
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
  const lines: string[] = []
  for (let y = 0; y < SCENE_HEIGHT - SPACER_ROWS - STATS_ROWS - CTA_ROWS; y += 1) {
    let line = ""
    const skyBg = y < SKY_ROWS ? seasonTintColor(getSkyColor(y, period, blend), season) : null
    for (const cell of buffer[y]!) {
      if (!cell.color) {
        line += cell.char
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
