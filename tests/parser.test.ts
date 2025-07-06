import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser'

describe('parse', () => {
  it('should parse text', () => {
    const script = dedent`
      hello world
      goodbye world
    `
    const parsed = parse(script)
    expect(parsed).toEqual([
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
    const script = dedent`
      hello world
      !!echo "test"
      goodbye world
      !!command-for-integration-tests.sh
    `
    const parsed = parse(script)

    expect(parsed).toEqual([
      {
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'command',
        content: 'echo "test"',
        ast: {
          type: 'Script',
          commands: [
            {
              type: 'Command',
              name: {
                text: 'echo',
                type: 'Word',
              },
              suffix: [
                {
                  text: 'test',
                  type: 'Word',
                },
              ],
            },
          ],
        },
      },
      {
        type: 'text',
        content: 'goodbye world',
      },
      {
        type: 'command',
        content: 'command-for-integration-tests.sh',
        ast: {
          type: 'Script',
          commands: [
            {
              type: 'Command',
              name: {
                text: 'command-for-integration-tests.sh',
                type: 'Word',
              },
            },
          ],
        },
      },
    ])
  })

  it('should throw error for command with no content after !!', () => {
    const script = dedent`
      !!
      hello
    `
    expect(() => parse(script)).toThrow(
      'Parse error at line 1: Command cannot be empty',
    )
  })

  it('should throw error for command with only whitespace', () => {
    const script = dedent`
      hello
      !!   
      world
    `
    expect(() => parse(script)).toThrow(
      'Parse error at line 2: Command cannot be empty',
    )
  })

  it('should throw error for invalid bash syntax', () => {
    const script = dedent`
      hello
      !!echo "unclosed quote
      world
    `
    expect(() => parse(script)).toThrow(
      /Parse error at line 2: Invalid bash syntax/,
    )
  })

  it('should parse complex command with full AST', () => {
    const script = dedent`
      !!command-for-integration-tests.sh --exit-code 42 --stdout "hello world" --stderr "error message"
    `
    const parsed = parse(script)

    expect(parsed).toEqual([
      {
        type: 'command',
        content:
          'command-for-integration-tests.sh --exit-code 42 --stdout "hello world" --stderr "error message"',
        ast: {
          type: 'Script',
          commands: [
            {
              type: 'Command',
              name: {
                text: 'command-for-integration-tests.sh',
                type: 'Word',
              },
              suffix: [
                {
                  text: '--exit-code',
                  type: 'Word',
                },
                {
                  text: '42',
                  type: 'Word',
                },
                {
                  text: '--stdout',
                  type: 'Word',
                },
                {
                  text: 'hello world',
                  type: 'Word',
                },
                {
                  text: '--stderr',
                  type: 'Word',
                },
                {
                  text: 'error message',
                  type: 'Word',
                },
              ],
            },
          ],
        },
      },
    ])
  })

  it('should throw error for compound commands', () => {
    const script = dedent`
      !!echo hello | grep hello
    `
    expect(() => parse(script)).toThrow(
      'Parse error at line 1: Only simple commands are allowed, found Pipeline',
    )
  })
})
