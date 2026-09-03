export class KeyedMutationQueue {
  private readonly tails = new Map<string, Promise<void>>()

  enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    const result = previous.then(task, task)
    const tail = result.then(() => undefined, () => undefined)
    this.tails.set(key, tail)
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return result
  }

  async waitFor(keys?: string[]) {
    const pending = keys
      ? keys.map((key) => this.tails.get(key)).filter((promise): promise is Promise<void> => Boolean(promise))
      : [...this.tails.values()]
    await Promise.all(pending)
  }
}
