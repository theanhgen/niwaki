import { describe, it, beforeEach, afterEach, expect } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const TEST_DIR = path.join(os.tmpdir(), `niwaki-state-${Date.now()}`)
process.env.NIWAKI_DIR = TEST_DIR

const { createEmptyForest, readForest, writeForest } = await import("../src/state.js")

describe("state", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it("creates the expected initial state", () => {
    const forest = createEmptyForest()
    expect(forest.trees).toEqual([])
    expect(forest.totalPrompts).toBe(0)
    expect(forest.createdAt).toBeTruthy()
  })

  it("round trips a forest through disk", () => {
    const forest = createEmptyForest()
    forest.trees.push({
      id: 1,
      type: "oak",
      growth: 0.8,
      x: 22,
      plantedAt: new Date().toISOString(),
    })
    forest.totalPrompts = 1

    writeForest(forest)
    const loaded = readForest()

    expect(loaded!.trees.length).toBe(1)
    expect(loaded!.trees[0]!.type).toBe("oak")
    expect(loaded!.totalPrompts).toBe(1)
  })

  it("returns null when the state file is missing", () => {
    expect(readForest()).toBeNull()
  })

  it("writes atomically without leaving tmp files behind", () => {
    writeForest(createEmptyForest())
    const files = fs.readdirSync(TEST_DIR)
    expect(files.includes("forest.json")).toBe(true)
    expect(files.some((name) => name.endsWith(".tmp"))).toBe(false)
  })
})
