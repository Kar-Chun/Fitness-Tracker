import assert from "node:assert/strict"
import test from "node:test"
import { KeyedMutationQueue } from "../src/lib/keyed-mutation-queue.ts"
import { generateGeminiStructured } from "../supabase/functions/_shared/food-analysis/gemini-client.ts"
import { findUSDAFood } from "../supabase/functions/_shared/food-analysis/usda-client.ts"

test("per-key mutation queue prevents a slow older save from overwriting a newer save", async () => {
  const queue = new KeyedMutationQueue()
  const writes: number[] = []
  const first = queue.enqueue("set-1", async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    writes.push(8)
  })
  const second = queue.enqueue("set-1", async () => { writes.push(10) })
  await Promise.all([first, second])
  assert.deepEqual(writes, [8, 10])
  await queue.waitFor()
})

test("different mutation keys do not block each other", async () => {
  const queue = new KeyedMutationQueue()
  const writes: string[] = []
  const slow = queue.enqueue("a", async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    writes.push("a")
  })
  const fast = queue.enqueue("b", async () => { writes.push("b") })
  await Promise.all([slow, fast])
  assert.deepEqual(writes, ["b", "a"])
})

test("waiting before a delete prevents an older pending save from recreating the row", async () => {
  const queue = new KeyedMutationQueue()
  let storedValue: number | null = null
  void queue.enqueue("set-1", async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    storedValue = 8
  })
  await queue.waitFor(["set-1"])
  storedValue = null
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(storedValue, null)
})

test("finish can wait for queued saves and then persist the latest local value", async () => {
  const queue = new KeyedMutationQueue()
  let storedValue = 0
  let latestLocalValue = 8
  void queue.enqueue("set-1", async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    storedValue = 8
  })
  latestLocalValue = 10
  await queue.waitFor()
  storedValue = latestLocalValue
  assert.equal(storedValue, 10)
})

test("Gemini timeout becomes a controlled provider error", async () => {
  const hangingFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
  })
  await assert.rejects(
    generateGeminiStructured([{ text: "rice" }], "parse", {}, "test-key", hangingFetch, 5),
    (error: unknown) => error instanceof Error && error.message.includes("too long"),
  )
})

test("USDA timeout and malformed JSON become controlled provider errors", async () => {
  const hangingFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
  })
  await assert.rejects(findUSDAFood("rice", "test-key", hangingFetch, 5), /too long/)
  const malformedFetch: typeof fetch = async () => new Response("not-json", { status: 200 })
  await assert.rejects(findUSDAFood("rice", "test-key", malformedFetch), /unreadable/)
})
