import type { Tree } from "./types.js"
import { getSprite, TREE_TYPES } from "./sprites.js"
import { createEmptyForest, readForest, writeForest } from "./state.js"
import { findBadgeFile, writeBadgeSVG } from "./badge.js"

const MIN_GAP = 4
const DEFAULT_WIDTH = 80

function getPlantWidth(forest: { viewerWidth?: number }): number {
  if (forest.viewerWidth && forest.viewerWidth > 40) return forest.viewerWidth
  return DEFAULT_WIDTH
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function randomGrowth(): number {
  return Math.round((0.3 + Math.random() * 0.7) * 100) / 100
}

function occupiedRanges(trees: Tree[]): [number, number][] {
  return trees.map((tree) => {
    const sprite = getSprite(tree.type, tree.growth)
    const half = Math.floor(sprite.width / 2)
    return [tree.x - half - MIN_GAP, tree.x + half + MIN_GAP]
  })
}

function findOpenX(trees: Tree[], type: string, growth: number, width: number, xRange?: [number, number]): number {
  const sprite = getSprite(type, growth)
  const half = Math.floor(sprite.width / 2)
  const margin = half + 1
  const ranges = occupiedRanges(trees)
  const lo = xRange ? Math.max(margin, xRange[0]) : margin
  const hi = xRange ? Math.min(width - margin, xRange[1]) : width - margin

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const x = lo + Math.floor(Math.random() * Math.max(1, hi - lo))
    const left = x - half
    const right = x + half
    const collides = ranges.some(
      ([occupiedLeft, occupiedRight]) => left < occupiedRight && right > occupiedLeft,
    )
    if (!collides) return x
  }

  return lo + Math.floor(Math.random() * Math.max(1, hi - lo))
}

function applyLightningStrike(trees: Tree[]): void {
  if (trees.length < 5) return
  if (Math.random() >= 0.02) return
  const candidates = trees.filter((t) => t.growth >= 0.5 && t.type !== "stump")
  if (candidates.length === 0) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]!
  target.growth = Math.max(0.1, Math.round((target.growth - 0.3) * 100) / 100)
}

function applyTreeFall(trees: Tree[]): void {
  if (trees.length < 10) return
  if (Math.random() >= 0.03) return
  const candidates = trees.filter((t) => t.growth >= 1 && t.type !== "stump")
  if (candidates.length === 0) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]!
  target.type = "stump"
}

function applySpeciesMutation(trees: Tree[]): void {
  if (Math.random() >= 0.01) return
  const candidates = trees.filter((t) => t.type !== "stump")
  if (candidates.length < 5) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]!
  const others = TREE_TYPES.filter((type) => type !== target.type)
  target.type = others[Math.floor(Math.random() * others.length)]!
}

function applyAnimalVisitor(trees: Tree[]): void {
  for (const tree of trees) {
    tree.visitor = undefined
  }
  if (Math.random() >= 0.05) return
  if (trees.length === 0) return
  const animals = ["fox", "deer", "owl"] as const
  const target = trees[Math.floor(Math.random() * trees.length)]!
  target.visitor = animals[Math.floor(Math.random() * animals.length)]!
}

function nudgeGrowth(growth: number): number {
  if (growth >= 1) return 1
  const nextGrowth = growth + 0.1 + Math.random() * 0.1
  return Math.min(1, Math.round(nextGrowth * 100) / 100)
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00")
  const b = new Date(dateB + "T00:00:00")
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

export async function plant(): Promise<void> {
  const forest = readForest() ?? createEmptyForest()
  const width = getPlantWidth(forest)

  const today = new Date().toISOString().slice(0, 10)
  if (forest.lastActiveDate) {
    const gap = daysBetween(forest.lastActiveDate, today)
    if (gap === 0) {
      forest.streak = Math.max(forest.streak ?? 0, 1)
    } else if (gap === 1) {
      forest.streak = (forest.streak ?? 1) + 1
    } else {
      forest.streak = 1
    }
  } else {
    forest.streak = 1
  }
  forest.lastActiveDate = today

  for (const tree of forest.trees) {
    if (tree.type === "stump") continue
    tree.growth = nudgeGrowth(tree.growth)
  }

  applyLightningStrike(forest.trees)
  applyTreeFall(forest.trees)
  applySpeciesMutation(forest.trees)
  applyAnimalVisitor(forest.trees)

  const type = randomItem(TREE_TYPES)
  const growth = randomGrowth()
  const nextId = forest.trees.reduce((max, tree) => Math.max(max, tree.id), 0) + 1

  let xRange: [number, number] | undefined
  const matureTrees = forest.trees.filter((t) => t.growth >= 0.7 && t.type !== "stump")
  if (matureTrees.length > 0 && Math.random() < 0.6) {
    const anchor = matureTrees[Math.floor(Math.random() * matureTrees.length)]!
    xRange = [anchor.x - 15, anchor.x + 15]
  }

  forest.trees.push({
    id: nextId,
    type,
    growth,
    x: findOpenX(forest.trees, type, growth, width, xRange),
    plantedAt: new Date().toISOString(),
  })
  forest.totalPrompts += 1

  writeForest(forest)

  try {
    const badgePath = findBadgeFile()
    if (badgePath) writeBadgeSVG(forest, badgePath)
  } catch {}
}
