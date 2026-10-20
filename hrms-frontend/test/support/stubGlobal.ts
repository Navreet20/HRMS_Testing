const originals = new Map<PropertyKey, unknown>();

/** Jest-friendly stand-in for stubbing globals (e.g. `fetch`). */
export function stubGlobal(name: PropertyKey, value: unknown): void {
  if (!originals.has(name)) {
    originals.set(
      name,
      Object.prototype.hasOwnProperty.call(globalThis, name)
        ? Reflect.get(globalThis, name)
        : undefined,
    );
  }
  Reflect.set(globalThis, name, value);
}

/** Restore globals stubbed via `stubGlobal`. */
export function unstubAllGlobals(): void {
  for (const [name, value] of originals) {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, name);
    } else {
      Reflect.set(globalThis, name, value);
    }
  }
  originals.clear();
}
