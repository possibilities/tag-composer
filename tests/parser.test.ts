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
    expect(result).toEqual([
      {
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'text',
        content: 'goodbye world',
      },
    ])
  })

  it('should parse commands starting with !!', () => {
    const input = dedent`
      hello world
      !!echo "test"
      goodbye world
      !!ls -la
    `
    const result = parseContent(input)
    expect(result).toEqual([
      {
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'command',
        content: 'echo "test"',
      },
      {
        type: 'text',
        content: 'goodbye world',
      },
      {
        type: 'command',
        content: 'ls -la',
      },
    ])
  })

  it('should throw error for command with no content after !!', () => {
    const input = dedent`
      !!
      hello
    `
    expect(() => parseContent(input)).toThrow(
      'Parse error at line 1: Command cannot be empty',
    )
  })

  it('should throw error for command with only whitespace', () => {
    const input = dedent`
      hello
      !!   
      world
    `
    expect(() => parseContent(input)).toThrow(
      'Parse error at line 2: Command cannot be empty',
    )
  })
})
