import { describe, it, beforeEach, afterEach, expect } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const TEST_DIR = path.join(os.tmpdir(), `niwaki-plant-${Date.now()}`)
process.env.NIWAKI_DIR = TEST_DIR

const { plant } = await import("../src/plant.js")
const { createEmptyForest, readForest, writeForest } = await import("../src/state.js")

describe("plant", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
    writeForest(createEmptyForest())
  })

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it("adds a tree to an empty forest", async () => {
    await plant()
    const forest = readForest()
    expect(forest!.trees.length).toBe(1)
    expect(forest!.totalPrompts).toBe(1)
  })

  it("adds the required tree fields", async () => {
    await plant()
    const [tree] = readForest()!.trees
    expect(["oak", "pine", "birch", "willow", "cherry", "maple", "ginkgo", "acacia", "baobab", "dragonblood", "araucaria", "olive", "banyan", "eucalyptus"].includes(tree!.type)).toBe(true)
    expect(tree!.growth >= 0.3 && tree!.growth <= 1).toBe(true)
    expect(typeof tree!.x).toBe("number")
    expect(tree!.id).toBe(1)
    expect(tree!.plantedAt).toBeTruthy()
  })

  it("increments ids", async () => {
    await plant()
    await plant()
    await plant()
    const ids = readForest()!.trees.map((tree) => tree.id)
    expect(ids).toEqual([1, 2, 3])
  })

  it("nudges partial trees toward full growth", async () => {
    const forest = createEmptyForest()
    forest.trees.push({
      id: 1,
      type: "oak",
      growth: 0.4,
      x: 20,
      plantedAt: new Date().toISOString(),
    })
    writeForest(forest)

    await plant()

    const updated = readForest()!
    const originalTree = updated.trees.find((tree) => tree.id === 1)!
    expect(originalTree.growth > 0.4).toBe(true)
    expect(originalTree.growth <= 1).toBe(true)
  })

  it("does not overgrow fully grown trees", async () => {
    const forest = createEmptyForest()
    forest.trees.push({
      id: 1,
      type: "pine",
      growth: 1,
      x: 15,
      plantedAt: new Date().toISOString(),
    })
    writeForest(forest)

    await plant()

    const updated = readForest()!
    expect(updated.trees.find((tree) => tree.id === 1)!.growth).toBe(1)
  })
})
