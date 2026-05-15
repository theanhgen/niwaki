import fs, { type FSWatcher } from "node:fs"

import { renderFrame, getStreamBounds, SKY_ROWS } from "./renderer.js"
import { getForestFile, readForest, writeForest } from "./state.js"

function writeAnsi(code: string): void {
  process.stdout.write(code)
}

function clearScreen(): void {
  writeAnsi("\x1b[2J\x1b[H")
}

function hideCursor(): void {
  writeAnsi("\x1b[?25l")
}

function showCursor(): void {
  writeAnsi("\x1b[?25h")
}

function moveHome(): void {
  writeAnsi("\x1b[H")
}

const MILESTONE_VALUES = [10, 25, 50, 100, 250, 500, 1000]

interface Bird {
  x: number
  y: number
  speed: number
}

interface Fox {
  x: number
  speed: number
}

interface Deer {
  x: number
  speed: number
}

interface Rabbit {
  x: number
  speed: number
}

interface Squirrel {
  x: number
  speed: number
  paused: boolean
  pauseLeft: number
}

let birds: Bird[] = []
let foxes: Fox[] = []
let rabbits: Rabbit[] = []
let shootingStarTrail: { x: number; y: number }[] = []
let deer: Deer | null = null
let activeMilestoneText: string | undefined = undefined
let isRaining = false
let rainUntil = 0
let postRainUntil = 0
let rainEventCount = 0
let fairyRingX: number | null = null
let windStrength: 0 | 1 | 2 = 0
let isLightning = false
let comet: { x: number; y: number } | null = null
let bearPrints: number[] | null = null
let bats: { x: number; y: number; speed: number }[] = []
let hawk: { x: number } | null = null
let squirrel: Squirrel | null = null
let meteorShower = false
let meteorShowerUntil = 0
let heron: { x: number } | null = null
let dragonfly: { x: number; y: number } | null = null
let streamFish: { x: number; leftward: boolean } | null = null
let woodpecker: { x: number; y: number; peck: boolean } | null = null
let weasel: { x: number; y: number; speed: number } | null = null
let frog: { x: number } | null = null
let fireflies: { x: number; y: number; lit: boolean; blinkTimer: number }[] = []
let owl: { x: number; y: number } | null = null
let butterfly: { x: number; y: number; color: string; dx: number; dy: number } | null = null
let clouds: { xf: number; y: number; width: number; density: 0|1|2 }[] = []
let crows: { x: number; speed: number; pecking: boolean; peckTimer: number }[] = []
let wildfire: { x: number; width: number; stage: string; until: number } | null = null
let beetles: { treePositions: { x: number; radius: number }[]; intensity: number; peakReached: boolean } | null = null
let drought: { intensity: number; fadingOut: boolean } | null = null
let blowdown: { seed: number; fallen: { x: number; dir: 1 | -1 }[]; until: number } | null = null
let blight: { zones: number[]; intensity: number; seed: number; fadingOut: boolean } | null = null
let frostEvent: { intensity: number; seed: number; fadingOut: boolean } | null = null
let lightningScars: { x: number; until: number }[] = []
let fallingLeaves: { xf: number; yf: number; dx: number; color: string; char: string }[] = []
let groundMushrooms: { x: number; until: number }[] = []
let morningDew = false
let pollenDrift: { xf: number; yf: number; dx: number }[] = []
let spiderWebs: { x: number; span: number; until: number }[] = []
let snail: { xf: number; tickCount: number } | null = null
let caterpillar: { segments: number[]; dir: 1 | -1; tickCount: number } | null = null
let otter: { x: number; diving: boolean; diveTimer: number } | null = null
let berries: { x: number; color: string }[] = []
let mossPatch = false
let seedDrift: { xf: number; yf: number; dx: number; char: string }[] = []
let badger: { x: number; speed: number } | null = null
let kingfisher: { x: number; diving: boolean; diveTimer: number; until: number } | null = null
let boar: { x: number; speed: number; rootingTimer: number } | null = null
let dawnChorus: { x: number; y: number; life: number }[] = []

function renderForest(forest: Parameters<typeof renderFrame>[0], twinkleSeed = 0, milestoneText?: string): void {
  moveHome()
  const frame = renderFrame(forest, process.stdout.columns || 80, {
    twinkleSeed,
    birds,
    foxes,
    rabbits,
    shootingStarTrail,
    deer: deer ?? undefined,
    fairyRingX: fairyRingX ?? undefined,
    milestoneText,
    isRaining,
    windStrength,
    postRain: Date.now() < postRainUntil,
    isLightning,
    comet: comet ?? undefined,
    bearPrints: bearPrints ?? undefined,
    bats,
    hawk: hawk ?? undefined,
    squirrel: squirrel ?? undefined,
    heron: heron ?? undefined,
    dragonfly: dragonfly ?? undefined,
    streamFish: streamFish ?? undefined,
    woodpecker: woodpecker ?? undefined,
    weasel: weasel ?? undefined,
    frog: frog ?? undefined,
    fireflies: fireflies.length > 0 ? fireflies : undefined,
    owl: owl ?? undefined,
    butterfly: butterfly ?? undefined,
    clouds: clouds.length > 0 ? clouds.map(c => ({ x: Math.floor(c.xf), y: c.y, width: c.width, density: c.density })) : undefined,
    crows: crows.length > 0 ? crows.map(c => ({ x: c.x, pecking: c.pecking })) : undefined,
    wildfire: wildfire ? { x: wildfire.x, width: wildfire.width, stage: wildfire.stage, seed: twinkleSeed } : undefined,
    beetles: beetles ? { zones: beetles.treePositions, intensity: beetles.intensity } : undefined,
    drought: drought ? { intensity: drought.intensity } : undefined,
    blowdown: blowdown ? { seed: blowdown.seed, fallen: blowdown.fallen } : undefined,
    blight: blight ? { zones: blight.zones, intensity: blight.intensity, seed: blight.seed } : undefined,
    frost: frostEvent ? { intensity: frostEvent.intensity, seed: frostEvent.seed } : undefined,
    lightningScars: lightningScars.length > 0 ? lightningScars.map(s => ({ x: s.x })) : undefined,
    fallingLeaves: fallingLeaves.length > 0 ? fallingLeaves.map(l => ({ x: Math.floor(l.xf), y: Math.floor(l.yf), color: l.color, char: l.char })) : undefined,
    groundMushrooms: groundMushrooms.length > 0 ? groundMushrooms.map(m => m.x) : undefined,
    morningDew,
    pollenDrift: pollenDrift.length > 0 ? pollenDrift.map(p => ({ x: Math.floor(p.xf), y: Math.floor(p.yf) })) : undefined,
    spiderWebs: spiderWebs.length > 0 ? spiderWebs.map(w => ({ x: w.x, span: w.span })) : undefined,
    snail: snail ? { x: Math.floor(snail.xf) } : undefined,
    caterpillar: caterpillar ? { segments: caterpillar.segments, dir: caterpillar.dir } : undefined,
    otter: otter ? { x: otter.x, diving: otter.diving } : undefined,
    berries: berries.length > 0 ? berries : undefined,
    mossPatch: mossPatch || undefined,
    seedDrift: seedDrift.length > 0 ? seedDrift.map(s => ({ x: Math.floor(s.xf), y: Math.floor(s.yf), char: s.char })) : undefined,
    badger: badger ? { x: badger.x } : undefined,
    kingfisher: kingfisher ? { x: kingfisher.x, diving: kingfisher.diving } : undefined,
    boar: boar ? { x: boar.x, rooting: boar.rootingTimer > 0 } : undefined,
    dawnChorus: dawnChorus.length > 0 ? dawnChorus : undefined,
  })
  process.stdout.write(frame.replace(/\n/g, "\x1b[K\n") + "\x1b[K\x1b[J")
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function animateNewTree(forest: Parameters<typeof renderFrame>[0], newTreeId: number): Promise<void> {
  const tree = forest.trees.find((entry) => entry.id === newTreeId)
  if (!tree) {
    renderForest(forest, 0, activeMilestoneText)
    return
  }

  const originalGrowth = tree.growth
  const frames = [0.12, 0.32, 0.6, originalGrowth].filter(
    (value, index, values) => value <= originalGrowth && values.indexOf(value) === index,
  )

  for (let index = 0; index < frames.length; index += 1) {
    tree.growth = frames[index]!
    renderForest(forest, index, activeMilestoneText)
    await delay(120)
  }

  tree.growth = originalGrowth
  renderForest(forest, 0, activeMilestoneText)
}

export async function viewer(): Promise<void> {
  const forestFile = getForestFile()
  let forest = readForest()

  if (!forest || !fs.existsSync(forestFile)) {
    console.error('No forest found. Run "niwaki init" first.')
    process.exit(1)
  }

  let ignoreNextChange = false
  function syncWidth(): void {
    const cols = process.stdout.columns || 80
    if (forest!.viewerWidth !== cols) {
      forest!.viewerWidth = cols
      ignoreNextChange = true
      writeForest(forest!)
    }
  }

  syncWidth()
  hideCursor()
  clearScreen()
  renderForest(forest, 0, activeMilestoneText)

  let lastMaxId = forest.trees.reduce((max, tree) => Math.max(max, tree.id), 0)
  let lastTotalPrompts = forest.totalPrompts
  let animating = false

  // Bird + bat + shooting star movement: 250ms tick
  setInterval(() => {
    const width = process.stdout.columns || 80
    birds = birds.filter((b) => b.x <= width)
    birds.forEach((b) => { b.x += b.speed + windStrength })
    // Bats fly right-to-left, y oscillates randomly
    bats = bats.filter((b) => b.x >= -3)
    bats.forEach((b) => {
      b.x -= b.speed
      if (Math.random() < 0.3) b.y = Math.max(0, Math.min(SKY_ROWS - 1, b.y + (Math.random() < 0.5 ? -1 : 1)))
    })
    // Advance shooting star trail diagonally (right 2, down 1)
    shootingStarTrail = shootingStarTrail
      .map((p) => ({ x: p.x + 2, y: p.y + 1 }))
      .filter((p) => p.y < SKY_ROWS && p.x < width)
    // Clouds drift left-to-right, speed scales with wind; wrap when off-screen
    for (const c of clouds) {
      c.xf += 0.08 + windStrength * 0.12
      if (c.xf > width + c.width) {
        c.xf = -(c.width + 5)
        c.y = 2 + Math.floor(Math.random() * Math.max(1, SKY_ROWS - 4))
      }
    }
    // Stream fish swims 1 col per tick, clears when out of stream
    if (streamFish) {
      streamFish.x += streamFish.leftward ? -1 : 1
      const bounds = getStreamBounds(forest!, width)
      if (!bounds || streamFish.x < bounds.x - 3 || streamFish.x > bounds.x + bounds.w + 3) streamFish = null
    }
    // Spring pollen drift — motes float gently sideways through canopy
    const pollenMonth = new Date().getMonth()
    const isSpring = pollenMonth >= 2 && pollenMonth <= 4
    if (isSpring && (forest?.trees.length ?? 0) > 0 && !isRaining) {
      if (pollenDrift.length < 14 && Math.random() < 0.3) {
        pollenDrift.push({
          xf: Math.random() * width,
          yf: SKY_ROWS + 1 + Math.random() * 3,
          dx: (Math.random() - 0.3) * 0.35 + windStrength * 0.2,
        })
      }
    } else if (!isSpring) {
      pollenDrift = []
    }
    pollenDrift = pollenDrift.filter(p => p.xf >= 0 && p.xf < width && p.yf < SKY_ROWS + 6)
    for (const p of pollenDrift) {
      p.yf += 0.06
      p.xf += p.dx + (Math.random() - 0.5) * 0.08
    }
    // Autumn leaf fall — leaves drift diagonally down from canopy
    const leafMonth = new Date().getMonth()
    const isAutumn = leafMonth >= 8 && leafMonth <= 10
    if (isAutumn && (forest?.trees.length ?? 0) > 0) {
      const autumnPalette = leafMonth === 8
        ? ["#b8aa30", "#c0b040", "#a89820"]
        : leafMonth === 9
        ? ["#d46030", "#c87820", "#b04818", "#c85030", "#d08820"]
        : ["#8a5020", "#7a4018", "#a06030", "#6a3810"]
      const leafChars = ["·", "∙", "'", "·"]
      if (fallingLeaves.length < 18 && Math.random() < 0.35) {
        const tree = forest!.trees[Math.floor(Math.random() * forest!.trees.length)]!
        const jitter = Math.floor(Math.random() * 7) - 3
        fallingLeaves.push({
          xf: tree.x + jitter,
          yf: SKY_ROWS + 1,
          dx: (Math.random() - 0.5) * 0.4 + windStrength * 0.25,
          color: autumnPalette[Math.floor(Math.random() * autumnPalette.length)]!,
          char: leafChars[Math.floor(Math.random() * leafChars.length)]!,
        })
      }
    }
    fallingLeaves = fallingLeaves.filter(l => l.yf < SKY_ROWS + 9)
    for (const l of fallingLeaves) {
      l.yf += 0.18
      l.xf += l.dx + (Math.random() - 0.5) * 0.12
    }
    // Seed drift — maple helicopters and dandelion fluff spin through mid-canopy
    const seedMonth = new Date().getMonth()
    const isSeedSeason = seedMonth >= 3 && seedMonth <= 9
    if (isSeedSeason && (forest?.trees.length ?? 0) > 0 && !isRaining) {
      const seedChars = ["⟨", "⟩", "·", "◌"]
      if (seedDrift.length < 10 && Math.random() < 0.15) {
        seedDrift.push({
          xf: Math.random() * width,
          yf: SKY_ROWS + 2 + Math.random() * 3,
          dx: (Math.random() - 0.5) * 0.5 + windStrength * 0.3,
          char: seedChars[Math.floor(Math.random() * seedChars.length)]!,
        })
      }
    } else if (!isSeedSeason) seedDrift = []
    seedDrift = seedDrift.filter(s => s.xf > -2 && s.xf < width + 2 && s.yf < SKY_ROWS + 7)
    for (const s of seedDrift) {
      s.yf += 0.12
      s.xf += s.dx
    }
    // Snail — moves 1 char every 8 ticks (~2s), clears when off-screen
    if (snail) {
      snail.tickCount++
      if (snail.tickCount >= 8) {
        snail.xf += 0.5
        snail.tickCount = 0
      }
      if (snail.xf > width + 2) snail = null
    }
    // Caterpillar — inches along undergrowth, 1 seg shift every 5 ticks (~1.25s)
    if (caterpillar) {
      caterpillar.tickCount++
      if (caterpillar.tickCount >= 5) {
        caterpillar.tickCount = 0
        const lead = caterpillar.segments[0]!
        const newLead = lead + caterpillar.dir
        caterpillar.segments = [newLead, ...caterpillar.segments.slice(0, -1)]
        if (newLead > width + 4 || newLead < -4) caterpillar = null
      }
    }
    // Otter — swims in stream, dives occasionally, moves 1 col per tick
    if (otter) {
      otter.x += 1
      if (otter.diveTimer > 0) {
        otter.diveTimer--
        if (otter.diveTimer === 0) otter.diving = false
      } else if (!otter.diving && Math.random() < 0.02) {
        otter.diving = true
        otter.diveTimer = 3 + Math.floor(Math.random() * 5)
      }
      const bounds = getStreamBounds(forest!, width)
      if (!bounds || otter.x > bounds.x + bounds.w + 4) otter = null
    }
    if (!animating) renderForest(forest!, 0, activeMilestoneText)
  }, 250)

  // Shooting star trigger — normal + rare meteor shower (multi-star burst)
  setInterval(() => {
    const h = new Date().getHours()
    const isNight = h >= 22 || h < 5
    if (!isNight) return
    const now = Date.now()
    if (meteorShower && now > meteorShowerUntil) meteorShower = false
    if (!meteorShower && Math.random() < 0.0005) {
      meteorShower = true
      meteorShowerUntil = now + (40 + Math.random() * 50) * 1000
    }
    const width = process.stdout.columns || 80
    const spawnCount = meteorShower ? 2 + Math.floor(Math.random() * 3) : (Math.random() < 0.008 ? 1 : 0)
    for (let s = 0; s < spawnCount; s++) {
      const startX = Math.floor(Math.random() * (width * 0.65))
      for (let i = 0; i < 5; i++) shootingStarTrail.push({ x: startX - i * 2, y: i })
    }
  }, 2000)

  // Bird spawn scheduler — season-aware migration
  function scheduleBirdSpawn(): void {
    const m = new Date().getMonth()
    const season = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "autumn" : "winter"
    const baseDelay = season === "winter" ? 480000 : season === "autumn" ? 70000 : season === "spring" ? 100000 : 150000
    const spawnDelay = baseDelay + Math.random() * baseDelay * 0.4
    setTimeout(() => {
      const width = process.stdout.columns || 80
      // Winter: sparse; autumn: large flocks migrating south; spring: returning groups; summer: normal
      const count = season === "winter" ? (Math.random() < 0.3 ? 1 : 0)
                  : season === "autumn" ? 2 + Math.floor(Math.random() * 4)
                  : season === "spring" ? 2 + Math.floor(Math.random() * 3)
                  : 1 + Math.floor(Math.random() * 3)
      const baseX = -count
      const y = Math.floor(Math.random() * (SKY_ROWS - 1))
      const speed = season === "autumn" ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i++) birds.push({ x: baseX + i, y, speed })
      scheduleBirdSpawn()
    }, spawnDelay)
  }
  scheduleBirdSpawn()

  // Rain tick: check every 90s, 20% chance to start a 3–10 min shower
  function spawnCloud(w: number, density: 0|1|2, startOffscreen = false): typeof clouds[0] {
    const width = w
    const cloudW = 10 + Math.floor(Math.random() * 20)
    const y = 2 + Math.floor(Math.random() * Math.max(1, SKY_ROWS - 4))
    const xf = startOffscreen ? -(cloudW + 5) : Math.random() * width
    return { xf, y, width: cloudW, density }
  }

  // Seed initial fair-weather clouds
  const initW = process.stdout.columns || 80
  for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
    clouds.push(spawnCloud(initW, (Math.random() < 0.7 ? 0 : 1) as 0|1, false))
  }

  // Rain tick: check every 90s, 20% chance to start a 3–10 min shower
  setInterval(() => {
    const now = Date.now()
    const width = process.stdout.columns || 80
    if (isRaining && now > rainUntil) {
      isRaining = false
      postRainUntil = now + 5 * 60 * 1000
      // Thin clouds back to 1-2 clearing cumulus
      for (const c of clouds) c.density = Math.max(0, c.density - 1) as 0|1|2
      setTimeout(() => {
        clouds = clouds.slice(0, 2)
        for (const c of clouds) c.density = 0
      }, 4 * 60 * 1000)
      // Frog emerges after rain — hopping to stream edge
      if (!frog && Math.random() < 0.6) {
        frog = { x: Math.floor(width * 0.3 + Math.random() * width * 0.4) }
        setTimeout(() => { frog = null }, (5 + Math.random() * 10) * 60 * 1000)
      }
      // Snail emerges after rain — very slow, crosses ground over ~15 min
      if (!snail && Math.random() < 0.5) {
        snail = { xf: -2, tickCount: 0 }
        setTimeout(() => { snail = null }, 20 * 60 * 1000)
      }
      // Mushrooms sprout after rain — 3-6 scattered across ground, persist 20-50 min
      const mushroomCount = 3 + Math.floor(Math.random() * 4)
      const now2 = Date.now()
      const mushroomDuration = (20 + Math.random() * 30) * 60 * 1000
      groundMushrooms = groundMushrooms.filter(m => now2 < m.until)
      for (let i = 0; i < mushroomCount; i++) {
        groundMushrooms.push({ x: Math.floor(Math.random() * width), until: now2 + mushroomDuration })
      }
    } else if (!isRaining && Math.random() < 0.20) {
      isRaining = true
      rainUntil = now + (3 + Math.random() * 7) * 60 * 1000
      rainEventCount += 1
      // Build storm clouds
      while (clouds.length < 4) clouds.push(spawnCloud(width, 2, clouds.length < 2))
      for (const c of clouds) c.density = 2
      if (rainEventCount >= 3 && fairyRingX === null) {
        fairyRingX = Math.floor(width * 0.3 + Math.random() * width * 0.4)
      }
    }
  }, 90 * 1000)

  // Fox + rabbit + squirrel movement
  setInterval(() => {
    const width = process.stdout.columns || 80
    foxes = foxes.filter((f) => f.x <= width + 2)
    foxes.forEach((f) => { f.x += f.speed })
    rabbits = rabbits.filter((r) => r.x <= width + 2)
    rabbits.forEach((r) => { r.x += r.speed })
    if (squirrel) {
      if (squirrel.x > width + 3) { squirrel = null }
      else if (squirrel.paused) {
        squirrel.pauseLeft -= 1
        if (squirrel.pauseLeft <= 0) squirrel.paused = false
      } else {
        squirrel.x += squirrel.speed
        if (Math.random() < 0.22) {
          squirrel.paused = true
          squirrel.pauseLeft = 2 + Math.floor(Math.random() * 4)
        }
      }
    }
    if (weasel) {
      const width = process.stdout.columns || 80
      if (weasel.x > width + 3) { weasel = null }
      else {
        weasel.x += weasel.speed
        weasel.y = 12 + Math.round(Math.sin(weasel.x * 0.3) * 0.5 + 0.5)
      }
    }
    // Crows: walk slowly, occasionally stop to peck
    crows = crows.filter(c => c.x <= (process.stdout.columns || 80) + 3)
    for (const c of crows) {
      if (c.pecking) {
        c.peckTimer--
        if (c.peckTimer <= 0) c.pecking = false
      } else {
        c.x += c.speed
        if (Math.random() < 0.08) { c.pecking = true; c.peckTimer = 3 + Math.floor(Math.random() * 6) }
      }
    }
    // Badger — slow nocturnal forager, shuffles across ground
    if (badger) {
      badger.x += badger.speed
      const w = process.stdout.columns || 80
      if (badger.x > w + 3) badger = null
    }
    // Wild boar — heavy rooter, stops to dig periodically
    if (boar) {
      const w = process.stdout.columns || 80
      if (boar.x > w + 4) { boar = null }
      else if (boar.rootingTimer > 0) {
        boar.rootingTimer--
      } else {
        boar.x += boar.speed
        if (Math.random() < 0.07) boar.rootingTimer = 5 + Math.floor(Math.random() * 8)
      }
    }
    // Kingfisher — dives and recovers, moves slowly along stream edge
    if (kingfisher) {
      const now = Date.now()
      if (now > kingfisher.until) { kingfisher = null }
      else if (kingfisher.diveTimer > 0) {
        kingfisher.diveTimer--
        if (kingfisher.diveTimer === 0) kingfisher.diving = false
      } else if (!kingfisher.diving && Math.random() < 0.05) {
        kingfisher.diving = true
        kingfisher.diveTimer = 2 + Math.floor(Math.random() * 4)
      }
    }
  }, 400)

  // Deer: crepuscular — spawns at dawn (5–8h) or dusk (17–21h), grazes then slowly walks off
  setInterval(() => {
    if (deer) return
    const h = new Date().getHours()
    const isDawnDusk = (h >= 5 && h < 8) || (h >= 17 && h < 21)
    if (!isDawnDusk || Math.random() > 0.35) return
    const width = process.stdout.columns || 80
    deer = { x: Math.floor(width * 0.25 + Math.random() * width * 0.5), speed: 0 }
    setTimeout(() => { if (deer) deer.speed = 1 }, (30 + Math.random() * 60) * 1000)
  }, 3 * 60 * 1000)

  setInterval(() => {
    const width = process.stdout.columns || 80
    if (deer) {
      deer.x += deer.speed
      if (deer.x > width + 3) deer = null
    }
    if (hawk) {
      hawk.x += 1
      if (hawk.x > width + 3) hawk = null
    }
  }, 2000)

  // Hawk: solitary soaring raptor, day only, every 20-40 min
  function scheduleHawkSpawn(): void {
    const delay = (20 + Math.random() * 20) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      if (h >= 7 && h < 19 && !hawk) hawk = { x: -2 }
      scheduleHawkSpawn()
    }, delay)
  }
  scheduleHawkSpawn()

  // Squirrel spawn: mornings and afternoons, every 10-25 min, dash-pause behavior
  function scheduleSquirrelSpawn(): void {
    const delay = (10 + Math.random() * 15) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      if (!squirrel && ((h >= 5 && h < 12) || (h >= 14 && h < 18))) {
        squirrel = { x: -2, speed: 3, paused: false, pauseLeft: 0 }
      }
      scheduleSquirrelSpawn()
    }, delay)
  }
  scheduleSquirrelSpawn()

  // Rabbit spawn: dawn only (5–8h), every 4–10 min, faster than fox
  function scheduleRabbitSpawn(): void {
    const delay = (4 + Math.random() * 6) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      if (h >= 5 && h < 8) rabbits.push({ x: -2, speed: 2 + Math.floor(Math.random() * 2) })
      scheduleRabbitSpawn()
    }, delay)
  }
  scheduleRabbitSpawn()

  // Fox spawn: crepuscular — most active at dusk (17-21h) and dawn (4-8h), rarely midday
  function scheduleFoxSpawn(): void {
    const delay = (8 + Math.random() * 12) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isCrepuscular = (h >= 17 && h < 22) || (h >= 4 && h < 8) || (h >= 22 || h < 4)
      const spawnChance = isCrepuscular ? 0.85 : 0.2
      if (Math.random() < spawnChance) foxes.push({ x: -2, speed: 1 })
      scheduleFoxSpawn()
    }, delay)
  }
  scheduleFoxSpawn()

  // Bat spawn: dusk and night, groups of 2-4, every 3-8 minutes
  function scheduleBatSpawn(): void {
    const delay = (3 + Math.random() * 5) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isDuskNight = h >= 19 || h < 5
      if (isDuskNight) {
        const width = process.stdout.columns || 80
        const count = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < count; i++) {
          bats.push({ x: width + 2 + i * 2, y: 1 + Math.floor(Math.random() * (SKY_ROWS - 2)), speed: 1 + Math.floor(Math.random() * 2) })
        }
      }
      scheduleBatSpawn()
    }, delay)
  }
  scheduleBatSpawn()

  // Heron: stands at stream edge during day/dawn, every 30-60 min, stays 5-20 min
  function scheduleHeronVisit(): void {
    const delay = (30 + Math.random() * 30) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isDayOrDawn = (h >= 5 && h < 20)
      if (isDayOrDawn && forest!.trees.length >= 10 && !heron) {
        const width = process.stdout.columns || 80
        heron = { x: Math.floor(width * 0.2 + Math.random() * width * 0.55) }
        setTimeout(() => { heron = null }, (5 + Math.random() * 15) * 60 * 1000)
      }
      scheduleHeronVisit()
    }, delay)
  }
  scheduleHeronVisit()

  // Dragonfly: summer days near water, every 10-20 min, lasts 3-8 min
  function scheduleDragonflySpawn(): void {
    const delay = (10 + Math.random() * 10) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const m = new Date().getMonth()
      const isSummer = m >= 5 && m <= 7
      if (isSummer && h >= 8 && h < 19 && !dragonfly && forest!.trees.length >= 10) {
        const width = process.stdout.columns || 80
        dragonfly = { x: Math.floor(width * 0.2 + Math.random() * width * 0.6), y: 9 }
        setTimeout(() => { dragonfly = null }, (3 + Math.random() * 5) * 60 * 1000)
      }
      scheduleDragonflySpawn()
    }, delay)
  }
  scheduleDragonflySpawn()

  // Stream fish: every 3-8 min, swims across in ~4s, spring/summer/autumn only
  function scheduleStreamFish(): void {
    const delay = (3 + Math.random() * 5) * 60 * 1000
    setTimeout(() => {
      const m = new Date().getMonth()
      const isFrozen = m <= 1 || m === 11
      if (!isFrozen && !isRaining && !streamFish) {
        const width = process.stdout.columns || 80
        const bounds = getStreamBounds(forest!, width)
        if (bounds) {
          const leftward = Math.random() < 0.5
          streamFish = { x: leftward ? bounds.x + bounds.w + 2 : bounds.x - 2, leftward }
        }
      }
      scheduleStreamFish()
    }, delay)
  }
  scheduleStreamFish()

  // Woodpecker: daytime, picks a random tree, taps for 2-5 min, every 15-30 min
  function scheduleWoodpecker(): void {
    const delay = (15 + Math.random() * 15) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      if (h >= 7 && h < 19 && !woodpecker && forest!.trees.length > 0) {
        const tree = forest!.trees[Math.floor(Math.random() * forest!.trees.length)]!
        woodpecker = { x: tree.x, y: 8, peck: false }
        setTimeout(() => { woodpecker = null }, (2 + Math.random() * 3) * 60 * 1000)
      }
      scheduleWoodpecker()
    }, delay)
  }
  scheduleWoodpecker()

  // Weasel: fast solitary hunter, dusk/dawn, every 20-40 min, dashes across ground
  function scheduleWeaselSpawn(): void {
    const delay = (20 + Math.random() * 20) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isDawnDusk = (h >= 4 && h < 8) || (h >= 18 && h < 22)
      if (isDawnDusk && !weasel) {
        weasel = { x: -3, y: 12, speed: 2 + Math.floor(Math.random() * 2) }
      }
      scheduleWeaselSpawn()
    }, delay)
  }
  scheduleWeaselSpawn()

  // Crows/ravens: autumn/winter ground scavengers, 1-3 at a time, every 15-30 min
  function scheduleCrowVisit(): void {
    const delay = (15 + Math.random() * 15) * 60 * 1000
    setTimeout(() => {
      const m = new Date().getMonth()
      const isAutumnWinter = m >= 8 || m <= 1
      if (isAutumnWinter && crows.length < 3) {
        const count = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < count; i++) {
          crows.push({ x: -3 - i * 4, speed: 1, pecking: false, peckTimer: 0 })
        }
      }
      scheduleCrowVisit()
    }, delay)
  }
  scheduleCrowVisit()

  // Wildfire: summer/autumn, rare trigger, 4-stage arc — smoke → burning → ember → ash
  setInterval(() => {
    const now = Date.now()
    const m = new Date().getMonth()
    const isSummerAutumn = m >= 5 && m <= 9
    if (wildfire) {
      if (now >= wildfire.until) {
        if (wildfire.stage === "smoke") {
          wildfire.stage = "burning"
          wildfire.until = now + (5 + Math.random() * 8) * 60 * 1000
        } else if (wildfire.stage === "burning") {
          wildfire.stage = "ember"
          wildfire.until = now + (3 + Math.random() * 5) * 60 * 1000
        } else if (wildfire.stage === "ember") {
          wildfire.stage = "ash"
          wildfire.until = now + (5 + Math.random() * 8) * 60 * 1000
        } else {
          wildfire = null
        }
      } else if (wildfire.stage === "burning") {
        const w = process.stdout.columns || 80
        const maxWidth = Math.min(Math.floor(w * 0.4), wildfire.width + 2 + windStrength)
        wildfire.width = maxWidth
      }
    } else if (isSummerAutumn && !isRaining && (forest?.trees.length ?? 0) >= 15 && Math.random() < 0.001) {
      const w = process.stdout.columns || 80
      const startX = Math.floor(w * 0.1 + Math.random() * w * 0.7)
      wildfire = {
        x: startX,
        width: 8 + Math.floor(Math.random() * 8),
        stage: "smoke",
        until: now + (2 + Math.random() * 2) * 60 * 1000,
      }
    }
  }, 30 * 1000)

  // Bark beetle infestation: warm season, ≥10 trees, spreads from 1-2 infected trees outward
  setInterval(() => {
    const m = new Date().getMonth()
    const isWarmSeason = m >= 3 && m <= 9
    const trees = (forest?.trees ?? []).filter(t => t.type !== "stump" && t.growth > 0.5)
    if (beetles) {
      if (!beetles.peakReached) {
        beetles.intensity = Math.min(1.0, beetles.intensity + 0.025)
        // Spread to nearest unclaimed neighbor tree
        if (beetles.intensity > 0.4 && beetles.treePositions.length < 6 && Math.random() < 0.35) {
          const candidate = trees
            .filter(t => !beetles!.treePositions.some(p => Math.abs(p.x - t.x) < 4))
            .sort((a, b) => {
              const dA = Math.min(...beetles!.treePositions.map(p => Math.abs(p.x - a.x)))
              const dB = Math.min(...beetles!.treePositions.map(p => Math.abs(p.x - b.x)))
              return dA - dB
            })[0]
          if (candidate) {
            const nearDist = Math.min(...beetles!.treePositions.map(p => Math.abs(p.x - candidate.x)))
            if (nearDist < 22) beetles.treePositions.push({ x: candidate.x, radius: 5 })
          }
        }
        if (beetles.intensity >= 1.0) {
          beetles.peakReached = true
          setTimeout(() => { beetles = null }, (12 + Math.random() * 18) * 60 * 1000)
        }
      }
    } else if (isWarmSeason && !wildfire && trees.length >= 10 && Math.random() < 0.0007) {
      const seed = trees[Math.floor(Math.random() * trees.length)]!
      beetles = { treePositions: [{ x: seed.x, radius: 5 }], intensity: 0.1, peakReached: false }
    }
  }, 60 * 1000)

  // Drought: builds slowly in summer, dries ground + stream, rain ends it
  setInterval(() => {
    const m = new Date().getMonth()
    const isSummer = m >= 5 && m <= 8
    if (drought) {
      if (isRaining || drought.fadingOut) {
        drought.intensity = Math.max(0, drought.intensity - 0.06)
        drought.fadingOut = true
        if (drought.intensity <= 0) drought = null
      } else {
        drought.intensity = Math.min(1.0, drought.intensity + 0.015)
        if (drought.intensity >= 1.0) {
          // Peak — schedule fade-out after 20-45 min
          drought.fadingOut = false
          setTimeout(() => { if (drought) drought.fadingOut = true }, (20 + Math.random() * 25) * 60 * 1000)
        }
      }
    } else if (isSummer && !isRaining && !wildfire && Math.random() < 0.0012) {
      drought = { intensity: 0.05, fadingOut: false }
    }
  }, 3 * 60 * 1000)

  // Storm blowdown: rare sudden event, any season, fells 2-5 trees, visual lasts 8-20 min
  setInterval(() => {
    const now = Date.now()
    if (blowdown) {
      if (now >= blowdown.until) blowdown = null
    } else if (!wildfire && (forest?.trees.length ?? 0) >= 8 && Math.random() < 0.0006) {
      const trees = (forest?.trees ?? []).filter(t => t.type !== "stump" && t.growth > 0.3)
      if (trees.length < 4) return
      const count = 2 + Math.floor(Math.random() * 4)
      const chosen = trees.sort(() => Math.random() - 0.5).slice(0, count)
      blowdown = {
        seed: Math.floor(Math.random() * 99999),
        fallen: chosen.map(t => ({ x: t.x, dir: (Math.random() < 0.5 ? 1 : -1) as 1 | -1 })),
        until: now + (8 + Math.random() * 12) * 60 * 1000,
      }
    }
  }, 45 * 1000)

  // Blight / fungal outbreak: damp seasons, spreads on infected trees, mushrooms + spores
  setInterval(() => {
    const m = new Date().getMonth()
    const isDamp = m >= 3 && m <= 10
    const trees = (forest?.trees ?? []).filter(t => t.type !== "stump" && t.growth > 0.4)
    if (blight) {
      if (blight.fadingOut) {
        blight.intensity = Math.max(0, blight.intensity - 0.04)
        if (blight.intensity <= 0) { blight = null; return }
      } else {
        blight.intensity = Math.min(1.0, blight.intensity + 0.02)
        // Spread to adjacent infected trees
        if (blight.intensity > 0.35 && blight.zones.length < 5 && Math.random() < 0.4) {
          const candidate = trees
            .filter(t => !blight!.zones.includes(t.x))
            .sort((a, b) => {
              const dA = Math.min(...blight!.zones.map(z => Math.abs(z - a.x)))
              const dB = Math.min(...blight!.zones.map(z => Math.abs(z - b.x)))
              return dA - dB
            })[0]
          if (candidate && Math.min(...blight!.zones.map(z => Math.abs(z - candidate.x))) < 18) {
            blight.zones.push(candidate.x)
          }
        }
        if (blight.intensity >= 1.0) {
          blight.fadingOut = false
          setTimeout(() => { if (blight) blight.fadingOut = true }, (15 + Math.random() * 20) * 60 * 1000)
        }
      }
    } else if (isDamp && !wildfire && trees.length >= 8 && Math.random() < 0.0006) {
      const seed = trees[Math.floor(Math.random() * trees.length)]!
      blight = { zones: [seed.x], intensity: 0.08, seed: Math.floor(Math.random() * 99999), fadingOut: false }
    }
  }, 75 * 1000)

  // Hard frost: late autumn/early spring nights, rapid onset, fades by midday
  setInterval(() => {
    const h = new Date().getHours()
    const m = new Date().getMonth()
    const isFrostSeason = (m >= 9 && m <= 11) || (m >= 0 && m <= 3)
    const isNightOrEarlyMorn = h >= 22 || h < 9
    if (frostEvent) {
      if (frostEvent.fadingOut || !isNightOrEarlyMorn || isRaining) {
        frostEvent.intensity = Math.max(0, frostEvent.intensity - 0.08)
        frostEvent.fadingOut = true
        if (frostEvent.intensity <= 0) { frostEvent = null; return }
      } else {
        frostEvent.intensity = Math.min(1.0, frostEvent.intensity + 0.1)
      }
    } else if (isFrostSeason && isNightOrEarlyMorn && !isRaining && Math.random() < 0.003) {
      frostEvent = { intensity: 0.1, seed: Math.floor(Math.random() * 99999), fadingOut: false }
    }
  }, 4 * 60 * 1000)

  // Morning dew: present at dawn (5–9h) when not raining, clear by mid-morning
  setInterval(() => {
    const h = new Date().getHours()
    morningDew = h >= 5 && h < 9 && !isRaining
  }, 5 * 60 * 1000)
  // Set immediately on start
  ;(() => { const h = new Date().getHours(); morningDew = h >= 5 && h < 9 && !isRaining })()

  // Spider webs: dawn/dusk between tree pairs, clear by mid-morning or if it rains
  setInterval(() => {
    const h = new Date().getHours()
    const now = Date.now()
    const isDawnDusk = (h >= 5 && h < 10) || (h >= 18 && h < 21)
    spiderWebs = spiderWebs.filter(w => now < w.until && !isRaining)
    if (isDawnDusk && !isRaining && spiderWebs.length < 3 && (forest?.trees.length ?? 0) >= 4 && Math.random() < 0.45) {
      const w = process.stdout.columns || 80
      const webX = Math.floor(Math.random() * (w - 15))
      const span = 8 + Math.floor(Math.random() * 10)
      spiderWebs.push({ x: webX, span, until: now + (1 + Math.random() * 3) * 60 * 60 * 1000 })
    }
  }, 8 * 60 * 1000)

  // Caterpillar: spring days, inches along undergrowth, every 15-30 min
  function scheduleCaterpillar(): void {
    const delay = (15 + Math.random() * 15) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const m = new Date().getMonth()
      const isSpringDay = (m >= 2 && m <= 5) && h >= 8 && h < 18
      if (isSpringDay && !caterpillar) {
        const w = process.stdout.columns || 80
        const segCount = 3 + Math.floor(Math.random() * 4)
        const startX = Math.floor(Math.random() * (w * 0.8))
        caterpillar = {
          segments: Array.from({ length: segCount }, (_, i) => startX - i),
          dir: 1,
          tickCount: 0,
        }
        setTimeout(() => { caterpillar = null }, (8 + Math.random() * 10) * 60 * 1000)
      }
      scheduleCaterpillar()
    }, delay)
  }
  scheduleCaterpillar()

  // Otter: spring/summer/autumn, swims through stream zone, every 20-40 min
  function scheduleOtter(): void {
    const delay = (20 + Math.random() * 20) * 60 * 1000
    setTimeout(() => {
      const m = new Date().getMonth()
      const isWaterSeason = m >= 2 && m <= 9
      if (isWaterSeason && !otter && (forest?.trees.length ?? 0) >= 10) {
        const w = process.stdout.columns || 80
        const bounds = getStreamBounds(forest!, w)
        if (bounds) otter = { x: bounds.x - 3, diving: false, diveTimer: 0 }
      }
      scheduleOtter()
    }, delay)
  }
  scheduleOtter()

  // Badger: nocturnal, emerges at dusk/night, shuffles slowly across ground
  function scheduleBadger(): void {
    const delay = (25 + Math.random() * 35) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isNight = h >= 20 || h < 5
      if (isNight && !badger) badger = { x: -3, speed: 1 }
      scheduleBadger()
    }, delay)
  }
  scheduleBadger()

  // Kingfisher: stream bird, day only, every 15-35 min, perches and dives
  function scheduleKingfisher(): void {
    const delay = (15 + Math.random() * 20) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const w = process.stdout.columns || 80
      if (h >= 7 && h < 20 && !kingfisher && (forest?.trees.length ?? 0) >= 10) {
        const bounds = getStreamBounds(forest!, w)
        if (bounds) {
          const now = Date.now()
          kingfisher = {
            x: bounds.x + Math.floor(Math.random() * bounds.w),
            diving: false,
            diveTimer: 0,
            until: now + (3 + Math.random() * 7) * 60 * 1000,
          }
        }
      }
      scheduleKingfisher()
    }, delay)
  }
  scheduleKingfisher()

  // Wild boar: autumn/winter, heavy ground forager, every 30-60 min
  function scheduleBoar(): void {
    const delay = (30 + Math.random() * 30) * 60 * 1000
    setTimeout(() => {
      const m = new Date().getMonth()
      const h = new Date().getHours()
      const isBoarSeason = m >= 8 || m <= 2
      const isBoarTime = h >= 6 && h < 21
      if (isBoarSeason && isBoarTime && !boar && (forest?.trees.length ?? 0) >= 8) {
        boar = { x: -4, speed: 1, rootingTimer: 0 }
      }
      scheduleBoar()
    }, delay)
  }
  scheduleBoar()

  // Berry clusters: summer/autumn, stable ground feature, refresh each season
  setInterval(() => {
    const m = new Date().getMonth()
    const isBerryTime = m >= 6 && m <= 10
    if (isBerryTime && berries.length < 8 && (forest?.trees.length ?? 0) >= 5) {
      const w = process.stdout.columns || 80
      const berryColors = m <= 8
        ? ["#c03050", "#8020a0", "#d06020"]  // summer: wild strawberry, blueberry, cloudberry
        : ["#902020", "#601880", "#c04818"]  // autumn: rose hip, elderberry, rowan
      berries.push({ x: Math.floor(Math.random() * w), color: berryColors[Math.floor(Math.random() * berryColors.length)]! })
    } else if (!isBerryTime) {
      berries = []
    }
  }, 10 * 60 * 1000)
  ;(() => {
    const m = new Date().getMonth()
    if (m >= 6 && m <= 10) {
      const w = process.stdout.columns || 80
      const berryColors = ["#c03050", "#8020a0", "#d06020"]
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++)
        berries.push({ x: Math.floor(Math.random() * w), color: berryColors[Math.floor(Math.random() * berryColors.length)]! })
    }
  })()

  // Moss: present in damp conditions after rain or in autumn/winter
  setInterval(() => {
    const m = new Date().getMonth()
    const isDamp = isRaining || m >= 8 || (m >= 0 && m <= 3)
    mossPatch = isDamp
  }, 3 * 60 * 1000)

  // Mushroom expiry tick: clean up expired ground mushrooms
  setInterval(() => {
    const now = Date.now()
    groundMushrooms = groundMushrooms.filter(m => now < m.until)
  }, 60 * 1000)

  // Fireflies: summer nights, blink in understory — spawn gradually up to 12, clear at dawn
  setInterval(() => {
    const h = new Date().getHours()
    const m = new Date().getMonth()
    const isSummerNight = (m >= 4 && m <= 8) && (h >= 21 || h < 4)
    if (!isSummerNight) { fireflies = []; return }
    if (fireflies.length >= 12 || forest!.trees.length < 5) return
    const width = process.stdout.columns || 80
    fireflies.push({
      x: Math.floor(Math.random() * width),
      y: 7 + Math.floor(Math.random() * 3),  // lower canopy / understory rows
      lit: Math.random() < 0.5,
      blinkTimer: 1 + Math.floor(Math.random() * 6),
    })
  }, 4000)

  // Owl: nocturnal predator, perches on a tree branch, every 25-50 min, stays 10-30 min
  function scheduleOwlVisit(): void {
    const delay = (25 + Math.random() * 25) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const isNight = h >= 21 || h < 5
      if (isNight && !owl && forest!.trees.length > 0) {
        const width = process.stdout.columns || 80
        const tree = forest!.trees[Math.floor(Math.random() * forest!.trees.length)]!
        owl = { x: Math.min(tree.x + 1, width - 1), y: 6 }
        setTimeout(() => { owl = null }, (10 + Math.random() * 20) * 60 * 1000)
      }
      scheduleOwlVisit()
    }, delay)
  }
  scheduleOwlVisit()

  // Butterfly: spring/summer days, every 8-18 min, flutters for 3-8 min
  function scheduleButterflySpawn(): void {
    const delay = (8 + Math.random() * 10) * 60 * 1000
    setTimeout(() => {
      const h = new Date().getHours()
      const m = new Date().getMonth()
      const isSpringOrSummer = m >= 2 && m <= 8
      const isDay = h >= 8 && h < 19
      if (isSpringOrSummer && isDay && !butterfly) {
        const width = process.stdout.columns || 80
        const springColors = ["#70c0e8", "#f0e060", "#f0b0e0"]
        const summerColors = ["#f08020", "#f04090", "#50e050", "#f0e060"]
        const palette = (m >= 5 && m <= 7) ? summerColors : springColors
        const color = palette[Math.floor(Math.random() * palette.length)]!
        butterfly = { x: Math.floor(Math.random() * width), y: 6 + Math.floor(Math.random() * 3), color, dx: Math.random() < 0.5 ? -1 : 1, dy: 0 }
        setTimeout(() => { butterfly = null }, (3 + Math.random() * 5) * 60 * 1000)
      }
      scheduleButterflySpawn()
    }, delay)
  }
  scheduleButterflySpawn()

  // Lightning + dragonfly dart: 500ms tick
  setInterval(() => {
    lightningScars = lightningScars.filter(s => Date.now() < s.until)
    if (isRaining && !animating && Math.random() < 0.03) {
      isLightning = true
      // 12% chance lightning leaves a lasting scar on a random tree
      if (Math.random() < 0.12 && (forest?.trees.length ?? 0) > 0) {
        const struckTree = forest!.trees[Math.floor(Math.random() * forest!.trees.length)]!
        lightningScars.push({ x: struckTree.x, until: Date.now() + (1.5 + Math.random() * 4) * 3600 * 1000 })
      }
      renderForest(forest!, 0, activeMilestoneText)
      setTimeout(() => {
        isLightning = false
        if (!animating) renderForest(forest!, 0, activeMilestoneText)
      }, 140)
    }
    if (woodpecker) woodpecker.peck = !woodpecker.peck
    // Butterfly — erratic flutter with gentle random walk
    if (butterfly) {
      const width = process.stdout.columns || 80
      if (butterfly.x < 0 || butterfly.x >= width || butterfly.y < 5 || butterfly.y > 10) {
        butterfly = null
      } else {
        butterfly.x = Math.max(1, Math.min(width - 2, butterfly.x + butterfly.dx + (Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0)))
        butterfly.y = Math.max(5, Math.min(10, butterfly.y + butterfly.dy + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0)))
        if (Math.random() < 0.25) butterfly.dx = Math.random() < 0.5 ? -1 : 1
        if (Math.random() < 0.15) butterfly.dy = Math.random() < 0.5 ? -1 : 1
      }
    }
    // Firefly blink — each firefly toggles independently
    for (const ff of fireflies) {
      ff.blinkTimer -= 1
      if (ff.blinkTimer <= 0) {
        ff.lit = !ff.lit
        ff.blinkTimer = ff.lit ? 1 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 5)
      }
    }
    if (dragonfly && Math.random() < 0.6) {
      const width = process.stdout.columns || 80
      const anchor = dragonfly
      dragonfly = {
        x: Math.max(0, Math.min(width - 1, anchor.x + Math.floor(Math.random() * 7) - 3)),
        y: Math.max(11 - 3, Math.min(11 - 1, anchor.y + (Math.random() < 0.5 ? -1 : 1))),
      }
    }
    // Dawn chorus — musical notes float up from trees in early morning
    const chorusH = new Date().getHours()
    const isChorusTime = chorusH >= 5 && chorusH < 7
    dawnChorus = dawnChorus.map(n => ({ ...n, y: n.y - 1, life: n.life - 1 })).filter(n => n.life > 0 && n.y >= 0)
    if (isChorusTime && (forest?.trees.length ?? 0) > 0 && Math.random() < 0.4) {
      const width = process.stdout.columns || 80
      const tree = forest!.trees[Math.floor(Math.random() * forest!.trees.length)]!
      dawnChorus.push({ x: Math.min(width - 1, tree.x + Math.floor(Math.random() * 5) - 2), y: SKY_ROWS, life: 7 + Math.floor(Math.random() * 5) })
    }
  }, 500)

  // Comet: rare night event, 0.1% per 5s check, crosses at 1 col/5s
  setInterval(() => {
    const h = new Date().getHours()
    const isNight = h >= 22 || h < 5
    if (comet) {
      comet.x += 1
      const width = process.stdout.columns || 80
      if (comet.x > width + 6) comet = null
      if (!animating) renderForest(forest!, 0, activeMilestoneText)
    } else if (isNight && Math.random() < 0.001) {
      const width = process.stdout.columns || 80
      comet = { x: 5, y: Math.floor(Math.random() * (SKY_ROWS - 2)) }
      const _ = width  // used above
    }
  }, 5000)

  // Bear paw prints: winter only, trail appears one-by-one, fades after 8 min
  function scheduleBearVisit(): void {
    const delay = (15 + Math.random() * 25) * 60 * 1000
    setTimeout(() => {
      const m = new Date().getMonth()
      const isWinter = m <= 1 || m === 11
      if (isWinter && !bearPrints) {
        const width = process.stdout.columns || 80
        const startX = Math.floor(Math.random() * (width * 0.7))
        const count = 4 + Math.floor(Math.random() * 4)
        bearPrints = []
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            if (bearPrints) bearPrints.push(startX + i * 3)
            if (!animating) renderForest(forest!, 0, activeMilestoneText)
          }, i * 3000)
        }
        setTimeout(() => { bearPrints = null }, 8 * 60 * 1000)
      }
      scheduleBearVisit()
    }, delay)
  }
  scheduleBearVisit()

  // Wind tick: shift strength every 5–15 minutes
  function scheduleWindChange(): void {
    const delay = (5 + Math.random() * 10) * 60 * 1000
    setTimeout(() => {
      const roll = Math.random()
      windStrength = roll < 0.5 ? 0 : roll < 0.85 ? 1 : 2
      scheduleWindChange()
    }, delay)
  }
  scheduleWindChange()

  const cleanup = (): void => {
    showCursor()
    clearScreen()
    console.log(
      `Forest summary: ${forest!.trees.length} trees across ${forest!.totalPrompts} prompts`,
    )
    process.exit(0)
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
  process.stdout.on("resize", () => {
    syncWidth()
    clearScreen()
    renderForest(forest!, 0, activeMilestoneText)
  })

  async function checkForUpdates(): Promise<void> {
    if (animating) return
    if (ignoreNextChange) {
      ignoreNextChange = false
      return
    }

    const updated = readForest()
    if (!updated) return
    if (updated.totalPrompts === lastTotalPrompts) return

    const nextMaxId = updated.trees.reduce((max, tree) => Math.max(max, tree.id), 0)

    // Milestone detection: check before updating forest reference
    const oldCount = forest!.trees.length
    const newCount = updated.trees.length
    const crossed = MILESTONE_VALUES.find((m) => oldCount < m && newCount >= m)
    if (crossed !== undefined) {
      activeMilestoneText = `✦ ${crossed} trees ✦`
      setTimeout(() => { activeMilestoneText = undefined }, 2500)
    }

    forest = updated
    lastTotalPrompts = forest.totalPrompts

    if (nextMaxId > lastMaxId) {
      lastMaxId = nextMaxId
      animating = true
      await animateNewTree(forest, nextMaxId)
      animating = false
    } else {
      renderForest(forest, 0, activeMilestoneText)
    }
  }

  function startWatcher(): FSWatcher | null {
    try {
      const watcher = fs.watch(forestFile, () => { checkForUpdates() })
      watcher.on("error", () => {})
      return watcher
    } catch {
      return null
    }
  }

  let watcher = startWatcher()

  let lastMtime = 0
  try { lastMtime = fs.statSync(forestFile).mtimeMs } catch {}

  setInterval(() => {
    try {
      const mtime = fs.statSync(forestFile).mtimeMs
      if (mtime !== lastMtime) {
        lastMtime = mtime
        checkForUpdates()
        if (watcher) { try { watcher.close() } catch {} }
        watcher = startWatcher()
      }
    } catch {}
  }, 800)
}
