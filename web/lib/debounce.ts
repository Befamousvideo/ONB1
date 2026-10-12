export function createDebounced<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
  schedule: (callback: () => void, ms: number) => unknown = setTimeout,
  cancel: (handle: unknown) => void = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
): (...args: Parameters<T>) => void {
  let handle: unknown = null
  return (...args: Parameters<T>) => {
    if (handle != null) cancel(handle)
    handle = schedule(() => {
      handle = null
      fn(...args)
    }, waitMs)
  }
}
