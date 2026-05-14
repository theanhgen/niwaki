import { describe, it, expect } from "bun:test"
import { renderFrame, SCENE_HEIGHT } from "../src/renderer.js"

const EMPTY_FOREST = {
  trees: [] as { id: number; type: string; growth: number; x: number; plantedAt: string }[],
  totalPrompts: 0,
  createdAt: "2026-04-12T00:00:00.000Z",
  lastActiveDate: "2026-04-12",
  streak: 0,
}

describe("renderer", () => {
  it("returns a string", () => {
    expect(typeof renderFrame(EMPTY_FOREST, 80)).toBe("string")
  })

  it("renders the expected number of lines", () => {
    const lines = renderFrame(EMPTY_FOREST, 80).split("\n")
    expect(lines.length).toBe(SCENE_HEIGHT)
  })

  it("renders ground blocks", () => {
    expect(renderFrame(EMPTY_FOREST, 40).includes("█")).toBe(true)
  })

  it("shows tree count in the stats bar", () => {
    const forest = {
      ...EMPTY_FOREST,
      trees: [
        { id: 1, type: "oak", growth: 1, x: 10, plantedAt: EMPTY_FOREST.createdAt },
        { id: 2, type: "pine", growth: 0.6, x: 28, plantedAt: EMPTY_FOREST.createdAt },
      ],
    }
    expect(renderFrame(forest, 80).includes("2 trees")).toBe(true)
  })

  it("changes the frame when a tree is present", () => {
    const withTree = renderFrame(
      {
        ...EMPTY_FOREST,
        trees: [{ id: 1, type: "oak", growth: 1, x: 18, plantedAt: EMPTY_FOREST.createdAt }],
      },
      80,
    )
    expect(withTree).not.toBe(renderFrame(EMPTY_FOREST, 80))
  })
})
