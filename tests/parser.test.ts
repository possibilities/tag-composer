import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parser'

describe('parseContent', () => {
  it('should parse text', () => {
    const input = dedent`
      hello world
      goodbye world
    `
    const result = parseContent(input)
    expect(result).toEqual(['hello world', 'goodbye world'])
  })
})
