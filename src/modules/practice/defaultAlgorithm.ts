/** Local preferred algorithm index per formula (catalog default = 0). */

export type DefaultAlgorithmStorage = {
  read(): string | null;
  write(value: string): void;
};

const STORAGE_KEY = "cube-trainer-default-algorithms";

export function browserDefaultAlgorithmStorage(): DefaultAlgorithmStorage {
  return {
    read() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Ignore write failures; this preference still applies in memory.
      }
    },
  };
}

/**
 * Resolve stored index to a valid algorithm index.
 * Missing / invalid id / out-of-range → catalog default (0).
 */
export function resolveDefaultAlgorithmIndex(
  algorithmCount: number,
  stored: number | undefined,
): number {
  if (!Number.isInteger(algorithmCount) || algorithmCount < 1) {
    return 0;
  }
  if (
    stored === undefined ||
    !Number.isInteger(stored) ||
    stored < 0 ||
    stored >= algorithmCount
  ) {
    return 0;
  }
  return stored;
}

export function createDefaultAlgorithmPrefs(storage: DefaultAlgorithmStorage) {
  return {
    /** Raw stored index, or undefined if unmarked. */
    peek(formulaId: string): number | undefined {
      const id = formulaId.trim();
      if (id === "") {
        return undefined;
      }
      return readAll(storage.read())[id];
    },
    get(formulaId: string, algorithmCount: number): number {
      const id = formulaId.trim();
      const stored = id === "" ? undefined : readAll(storage.read())[id];
      return resolveDefaultAlgorithmIndex(algorithmCount, stored);
    },
    /**
     * Mark preferred algorithm. Index 0 clears the mark (catalog default).
     * Invalid formula / index is ignored (no throw for UI callers).
     */
    set(formulaId: string, algorithmIndex: number, algorithmCount: number) {
      const id = formulaId.trim();
      if (id === "") {
        return;
      }
      const all = readAll(storage.read());
      if (
        !Number.isInteger(algorithmIndex) ||
        algorithmIndex < 0 ||
        algorithmIndex >= algorithmCount
      ) {
        return;
      }
      if (algorithmIndex === 0) {
        delete all[id];
      } else {
        all[id] = algorithmIndex;
      }
      storage.write(JSON.stringify(all));
    },
  };
}

function readAll(raw: string | null): Record<string, number> {
  if (raw === null || raw.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}
