import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parse-content'
import { parseCommands } from '../src/parse-commands'
import { executeCommands } from '../src/execute-commands'
import path from 'path'

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
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'hello world' }],
          },
        ],
      },
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'goodbye world' }],
          },
        ],
      },
    ])
  })

  it('should parse unparsed commands starting with !!', () => {
    const script = dedent`
      hello world
      !!echo "test"
      goodbye world
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'hello world' }],
          },
        ],
      },
      {
        type: 'command',
        input: 'echo "test"',
      },
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'goodbye world' }],
          },
        ],
      },
    ])
  })

  it('should parse and execute commands through the full pipeline', async () => {
    const script = dedent`
      hello world
      !!echo "test"
      goodbye world
    `
    const parsed = executeCommands(parseCommands(parseContent(script)))

    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'hello world' }],
          },
        ],
      },
      {
        type: 'element',
        name: 'command',
        attributes: { name: 'echo' },
        commandName: 'echo',
        ast: expect.any(Object),
        elements: expect.arrayContaining([
          {
            type: 'element',
            name: 'input',
            elements: [{ type: 'text', text: 'echo "test"' }],
          },
          {
            type: 'element',
            name: 'exit',
            attributes: {
              status: 'success',
              code: '0',
            },
          },
          {
            type: 'element',
            name: 'stdout',
            elements: [{ type: 'text', text: 'test' }],
          },
          {
            type: 'element',
            name: 'stderr',
          },
        ]),
      },
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'goodbye world' }],
          },
        ],
      },
    ])
  })

  it('should throw error for command with no content after !!', () => {
    const script = dedent`
      !!
      hello
    `
    expect(() => parseContent(script)).toThrow(
      'Parse error at line 1: Command cannot be empty',
    )
  })

  it('should throw error for command with only whitespace', () => {
    const script = dedent`
      hello
      !!
      world
    `
    expect(() => parseContent(script)).toThrow(
      'Parse error at line 2: Command cannot be empty',
    )
  })

  it('should parse commands with invalid syntax without throwing', () => {
    const script = dedent`
      hello
      !!echo "unclosed quote
      world
    `

    const parsed = parseContent(script)
    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'hello' }],
          },
        ],
      },
      {
        type: 'command',
        input: 'echo "unclosed quote',
      },
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'world' }],
          },
        ],
      },
    ])

    expect(() => parseCommands(parsed)).toThrow(/Invalid bash syntax/)
  })

  it('should parse unparsed commands that will be identified as calling commands later', () => {
    const script = dedent`
      !!echo "first command"
      !!grep "pattern"
      !!ls -la
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'command',
        input: 'echo "first command"',
      },
      {
        type: 'command',
        input: 'grep "pattern"',
      },
      {
        type: 'command',
        input: 'ls -la',
      },
    ])

    const parsedCommands = parseCommands(parsed, 'tag-composer')

    expect(parsedCommands[0]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
    })

    expect(parsedCommands[1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'grep' },
      commandName: 'grep',
    })

    expect(parsedCommands[2]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'ls' },
      commandName: 'ls',
    })
  })

  it('should parse commands that default to not being calling commands', () => {
    const script = dedent`
      !!echo "test"
      !!grep "pattern"
    `
    const parsed = parseContent(script)
    const parsedCommands = parseCommands(parsed)

    expect(parsedCommands[0]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
    })

    expect(parsedCommands[1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'grep' },
      commandName: 'grep',
    })
  })

  it('should parse and execute complex command', async () => {
    const testScriptPath = path.join(
      process.cwd(),
      'tests/helpers/command-for-integration-tests.sh',
    )
    const script = dedent`
      !!${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"
    `
    const parsed = executeCommands(parseCommands(parseContent(script)))

    expect(parsed).toEqual([
      {
        type: 'element',
        name: 'command',
        attributes: { name: testScriptPath },
        commandName: testScriptPath,
        ast: expect.any(Object),
        elements: expect.arrayContaining([
          {
            type: 'element',
            name: 'input',
            elements: [
              {
                type: 'text',
                text: `${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"`,
              },
            ],
          },
          {
            type: 'element',
            name: 'exit',
            attributes: {
              status: 'failure',
              code: '42',
            },
          },
          {
            type: 'element',
            name: 'stdout',
            elements: [{ type: 'text', text: 'hello world' }],
          },
          {
            type: 'element',
            name: 'stderr',
            elements: [{ type: 'text', text: 'error message' }],
          },
        ]),
      },
    ])
  })

  it('should throw error for compound commands in parse phase', async () => {
    const script = dedent`
      !!echo hello | grep hello
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'command',
        input: 'echo hello | grep hello',
      },
    ])

    expect(() => parseCommands(parsed)).toThrow(
      'Only simple commands are allowed',
    )
  })
})
