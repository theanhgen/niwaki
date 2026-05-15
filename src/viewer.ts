import fs, { type FSWatcher } from "node:fs"

import { renderFrame } from "./renderer.js"
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
      if (Math.random() < 0.3) b.y = Math.max(0, Math.min(3, b.y + (Math.random() < 0.5 ? -1 : 1)))
    })
    // Advance shooting star trail diagonally (right 2, down 1)
    shootingStarTrail = shootingStarTrail
      .map((p) => ({ x: p.x + 2, y: p.y + 1 }))
      .filter((p) => p.y < 4 && p.x < width)
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
      const y = Math.floor(Math.random() * 3)
      const speed = season === "autumn" ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i++) birds.push({ x: baseX + i, y, speed })
      scheduleBirdSpawn()
    }, spawnDelay)
  }
  scheduleBirdSpawn()

  // Rain tick: check every 90s, 20% chance to start a 3–10 min shower
  setInterval(() => {
    const now = Date.now()
    if (isRaining && now > rainUntil) {
      isRaining = false
      postRainUntil = now + 5 * 60 * 1000
    } else if (!isRaining && Math.random() < 0.20) {
      isRaining = true
      rainUntil = now + (3 + Math.random() * 7) * 60 * 1000
      rainEventCount += 1
      if (rainEventCount >= 3 && fairyRingX === null) {
        const width = process.stdout.columns || 80
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

  // Fox spawn: every 8–20 minutes, a single fox trots through
  function scheduleFoxSpawn(): void {
    const delay = (8 + Math.random() * 12) * 60 * 1000
    setTimeout(() => {
      foxes.push({ x: -2, speed: 1 })
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
          bats.push({ x: width + 2 + i * 2, y: 1 + Math.floor(Math.random() * 2), speed: 1 + Math.floor(Math.random() * 2) })
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

  // Lightning + dragonfly dart: 500ms tick
  setInterval(() => {
    if (isRaining && !animating && Math.random() < 0.03) {
      isLightning = true
      renderForest(forest!, 0, activeMilestoneText)
      setTimeout(() => {
        isLightning = false
        if (!animating) renderForest(forest!, 0, activeMilestoneText)
      }, 140)
    }
    if (dragonfly && Math.random() < 0.6) {
      const width = process.stdout.columns || 80
      const anchor = dragonfly
      dragonfly = {
        x: Math.max(0, Math.min(width - 1, anchor.x + Math.floor(Math.random() * 7) - 3)),
        y: Math.max(11 - 3, Math.min(11 - 1, anchor.y + (Math.random() < 0.5 ? -1 : 1))),
      }
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
      comet = { x: 5, y: Math.floor(Math.random() * 3) }
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
