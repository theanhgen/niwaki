import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { createEmptyForest, getNiwakiDir, readForest, writeForest } from "./state.js"

function getClaudeSettingsPath(): string {
  const claudeRoot = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")
  return path.join(claudeRoot, "settings.json")
}

const NIWAKI_STOP_HOOK = {
  matcher: "",
  hooks: [{ type: "command", command: "niwaki plant" }],
}

function hasNiwakiHook(settings: Record<string, unknown>): boolean {
  const hooks = settings.hooks as Record<string, unknown> | undefined
  const stop = hooks?.Stop as Array<Record<string, unknown>> | undefined
  return stop?.some((entry) => {
    const entryHooks = entry.hooks as Array<Record<string, string>> | undefined
    return entryHooks?.some((hook) => hook.command === "niwaki plant")
  }) ?? false
}

export async function init(): Promise<void> {
  const niwakiDir = getNiwakiDir()
  fs.mkdirSync(niwakiDir, { recursive: true })

  const existing = readForest()
  if (!existing) {
    writeForest(createEmptyForest())
    console.log(`Created ${path.join(niwakiDir, "forest.json")}`)
  } else {
    let migrated = false
    if (existing.lastActiveDate === undefined) {
      existing.lastActiveDate = new Date().toISOString().slice(0, 10)
      migrated = true
    }
    if (existing.streak === undefined) {
      existing.streak = 0
      migrated = true
    }
    if (migrated) {
      writeForest(existing)
      console.log(`Updated forest with streak tracking (${existing.trees.length} trees kept)`)
    } else {
      console.log(`Forest already up to date at ${path.join(niwakiDir, "forest.json")}`)
    }
  }

  const settingsPath = getClaudeSettingsPath()
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })

  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>
  } catch {
    settings = {}
  }

  if (!settings.hooks) settings.hooks = {}
  const hooks = settings.hooks as Record<string, unknown>
  if (!hooks.Stop) hooks.Stop = []

  if (hasNiwakiHook(settings)) {
    console.log(`Claude Code hook already configured in ${settingsPath}`)
  } else {
    (hooks.Stop as unknown[]).push(NIWAKI_STOP_HOOK)
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
    console.log(`Added niwaki Stop hook to ${settingsPath}`)
  }

  console.log("")
  console.log("Setup complete.")
  console.log("Run `niwaki` in a separate terminal to watch the forest grow.")
}
