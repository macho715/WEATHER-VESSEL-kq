import { afterEach } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})
