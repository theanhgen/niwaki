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

let birds: Bird[] = []
let activeMilestoneText: string | undefined = undefined
let isRaining = false
let rainUntil = 0
let postRainUntil = 0
let windStrength: 0 | 1 | 2 = 0

function renderForest(forest: Parameters<typeof renderFrame>[0], twinkleSeed = 0, milestoneText?: string): void {
  moveHome()
  const frame = renderFrame(forest, process.stdout.columns || 80, {
    twinkleSeed,
    birds,
    milestoneText,
    isRaining,
    windStrength,
    postRain: Date.now() < postRainUntil,
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

  // Bird movement: advance each bird every 250ms (wind speeds them up), re-render if not animating
  setInterval(() => {
    const width = process.stdout.columns || 80
    birds = birds.filter((b) => b.x <= width)
    birds.forEach((b) => { b.x += b.speed + windStrength })
    if (!animating) renderForest(forest!, 0, activeMilestoneText)
  }, 250)

  // Bird spawn scheduler: 2.5–3.5 minutes between flocks
  function scheduleBirdSpawn(): void {
    const spawnDelay = 150000 + Math.random() * 60000
    setTimeout(() => {
      const width = process.stdout.columns || 80
      const count = 1 + Math.floor(Math.random() * 3)
      const baseX = -count
      const y = Math.floor(Math.random() * 3)
      const speed = 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i++) {
        birds.push({ x: baseX + i, y, speed })
      }
      scheduleBirdSpawn()
    }, spawnDelay)
  }
  scheduleBirdSpawn()

  // Rain tick: check every 90s, 20% chance to start a 3–10 min shower
  setInterval(() => {
    const now = Date.now()
    if (isRaining && now > rainUntil) {
      isRaining = false
      postRainUntil = now + 5 * 60 * 1000  // 5 min post-rain window
    } else if (!isRaining && Math.random() < 0.20) {
      isRaining = true
      rainUntil = now + (3 + Math.random() * 7) * 60 * 1000
    }
  }, 90 * 1000)

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
