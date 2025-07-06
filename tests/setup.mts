import { beforeAll, afterAll } from 'vitest'
import path from 'path'

const originalPath = process.env.PATH

beforeAll(() => {
  // Add tests/helpers to PATH
  const helpersPath = path.join(process.cwd(), 'tests', 'helpers')
  process.env.PATH = `${helpersPath}:${process.env.PATH}`
})

afterAll(() => {
  // Restore original PATH
  process.env.PATH = originalPath
})