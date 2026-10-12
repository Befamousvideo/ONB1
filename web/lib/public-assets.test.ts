import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const forbidden = ["Red" + " O", "redo" + "restaurant", "Fashion" + " Island", "Tea" + "sta"]

function walk(dir: string, found: string[]): void {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "cache") continue
    const path = join(dir, entry)
    const info = statSync(path)
    if (info.isDirectory()) {
      walk(path, found)
      continue
    }
    if (!/\.(js|jsx|ts|tsx|json|css|html|txt|map|mjs)$/.test(entry)) continue
    if (entry.endsWith(".test.ts")) continue
    const text = readFileSync(path, "utf8")
    for (const needle of forbidden) {
      if (text.includes(needle)) found.push(`${path} contains ${needle}`)
    }
  }
}

test("served and bundled interview assets stay generic", () => {
  const root = join(__dirname, "..")
  const hits: string[] = []
  for (const dir of ["app", "lib", "data", "public", join(".next", "static"), join(".next", "server")]) {
    walk(join(root, dir), hits)
  }
  assert.deepEqual(hits, [])
})
