import { describe, it, expect } from "bun:test"
import { getSprite, TREE_TYPES } from "../src/sprites.js"

describe("sprites", () => {
  it("exports all fourteen tree types", () => {
    expect(TREE_TYPES).toEqual([
      "oak", "pine", "birch", "willow", "cherry",
      "maple", "ginkgo", "acacia", "baobab", "dragonblood",
      "araucaria", "olive", "banyan", "eucalyptus",
    ])
  })

  it("returns sprites for every growth tier", () => {
    for (const type of TREE_TYPES) {
      for (const growth of [0.1, 0.3, 0.6, 1]) {
        const sprite = getSprite(type, growth)
        expect(Array.isArray(sprite.rows)).toBe(true)
        expect(sprite.rows.length > 0).toBe(true)
        expect(sprite.width > 0).toBe(true)
      }
    }
  })

  it("full trees are wider than seeds", () => {
    for (const type of TREE_TYPES) {
      expect(getSprite(type, 1).width > getSprite(type, 0.1).width).toBe(true)
    }
  })

  it("stores rows as [char, color] tuples", () => {
    const sprite = getSprite("oak", 1)
    for (const row of sprite.rows) {
      for (const cell of row) {
        expect(Array.isArray(cell)).toBe(true)
        expect(cell.length).toBe(2)
      }
    }
  })
})
