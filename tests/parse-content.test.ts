import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parse-content'

describe('parseContent', () => {
  it('should parse text', () => {
    const script = dedent`
      hello world
      goodbye world
    `
    const parsed = parseContent(script)
    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'hello world' }],
      },
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'goodbye world' }],
      },
    ])
  })

  it('should parse markdown references starting with @@', () => {
    const script = dedent`
      hello world
      @@test.md
      goodbye world
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'hello world' }],
      },
      {
        type: 'markdown-reference',
        path: 'test.md',
      },
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'goodbye world' }],
      },
    ])
  })

  it('should parse markdown references with paths', () => {
    const script = dedent`
      @@foo/bar.md
      @@../other.md
      @@/absolute/path.md
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'markdown-reference',
        path: 'foo/bar.md',
      },
      {
        type: 'markdown-reference',
        path: '../other.md',
      },
      {
        type: 'markdown-reference',
        path: '/absolute/path.md',
      },
    ])
  })

  it('should handle markdown references with extra whitespace', () => {
    const script = dedent`
      @@  test.md
      @@test2.md  
      @@  test3.md  
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'markdown-reference',
        path: 'test.md',
      },
      {
        type: 'markdown-reference',
        path: 'test2.md',
      },
      {
        type: 'markdown-reference',
        path: 'test3.md',
      },
    ])
  })

  it('should throw error for markdown reference with no path after @@', () => {
    const script = dedent`
      @@
      hello
    `
    expect(() => parseContent(script)).toThrow(
      'Parse error at line 1: Markdown reference path cannot be empty',
    )
  })

  it('should throw error for markdown reference that does not end with .md', () => {
    const script = dedent`
      @@test.txt
    `
    expect(() => parseContent(script)).toThrow(
      'Parse error at line 1: Markdown reference must end with .md',
    )
  })

  it('should throw error for lines starting with @@ but not ending with .md', () => {
    const script1 = dedent`
      @@this is not a markdown reference
    `
    expect(() => parseContent(script1)).toThrow(
      'Parse error at line 1: Markdown reference must end with .md',
    )

    const script2 = dedent`
      @@ neither is this
    `
    expect(() => parseContent(script2)).toThrow(
      'Parse error at line 1: Markdown reference must end with .md',
    )
  })

  it('should only detect @@ at the start of a trimmed line', () => {
    const script = dedent`
      This line contains @@test.md in the middle
        @@indented.md
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [
          { type: 'text', text: 'This line contains @@test.md in the middle' },
        ],
      },
      {
        type: 'markdown-reference',
        path: 'indented.md',
      },
    ])
  })
})
