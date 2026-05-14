import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import type { Forest } from "./types.js"

function resolveNiwakiDir(): string {
  return process.env.NIWAKI_DIR ?? path.join(os.homedir(), ".niwaki")
}

function resolveForestFile(): string {
  return path.join(resolveNiwakiDir(), "forest.json")
}

export const NIWAKI_DIR: string = resolveNiwakiDir()
export const FOREST_FILE: string = resolveForestFile()

export function getNiwakiDir(): string {
  return resolveNiwakiDir()
}

export function getForestFile(): string {
  return resolveForestFile()
}

export function createEmptyForest(): Forest {
  return {
    trees: [],
    totalPrompts: 0,
    createdAt: new Date().toISOString(),
    lastActiveDate: new Date().toISOString().slice(0, 10),
    streak: 0,
  }
}

export function readForest(): Forest | null {
  try {
    return JSON.parse(fs.readFileSync(resolveForestFile(), "utf8")) as Forest
  } catch {
    return null
  }
}

export function writeForest(state: Forest): void {
  const dir = resolveNiwakiDir()
  const file = resolveForestFile()
  fs.mkdirSync(dir, { recursive: true })
  const tmpFile = path.join(
    dir,
    `forest.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`,
  )
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2))
  fs.renameSync(tmpFile, file)
}
