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
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'text',
        content: 'goodbye world',
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
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'command',
        input: 'echo "test"',
      },
      {
        type: 'text',
        content: 'goodbye world',
      },
    ])
  })

  it('should parse and execute commands through the full pipeline', () => {
    const script = dedent`
      hello world
      !!echo "test"
      goodbye world
    `
    const parsed = executeCommands(parseCommands(parseContent(script)))

    const cleanedResult = parsed.map(line => {
      if ('isCallingCommand' in line) {
        const { isCallingCommand, ...rest } = line
        return rest
      }
      return line
    })

    expect(cleanedResult).toEqual([
      {
        type: 'text',
        content: 'hello world',
      },
      {
        type: { name: 'command', attrs: { name: 'echo' } },
        input: 'echo "test"',
        commandName: 'echo',
        exit: {
          name: 'exit',
          attrs: {
            status: 'success',
            code: '0',
          },
        },
        stdout: 'test\n',
        stderr: '',
      },
      {
        type: 'text',
        content: 'goodbye world',
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
    // parseContent should NOT throw for invalid syntax - that's parseCommands job
    const parsed = parseContent(script)
    expect(parsed).toEqual([
      {
        type: 'text',
        content: 'hello',
      },
      {
        type: 'command',
        input: 'echo "unclosed quote',
      },
      {
        type: 'text',
        content: 'world',
      },
    ])

    // But parseCommands should throw
    expect(() => parseCommands(parsed)).toThrow(/Invalid bash syntax/)
  })

  it('should parse unparsed commands that will be identified as calling commands later', () => {
    const script = dedent`
      !!echo "first command"
      !!grep "pattern"
      !!echo "third command"
    `
    const parsed = parseContent(script)

    // parseContent no longer handles callingCommandName
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
        input: 'echo "third command"',
      },
    ])

    // parseCommands handles callingCommandName
    const parsedCommands = parseCommands(parsed, 'echo')

    expect(parsedCommands[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: true,
    })

    expect(parsedCommands[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'grep' } },
      commandName: 'grep',
      isCallingCommand: false,
    })

    expect(parsedCommands[2]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: true,
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
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: false,
    })

    expect(parsedCommands[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'grep' } },
      commandName: 'grep',
      isCallingCommand: false,
    })
  })

  it('should parse and execute complex command', () => {
    const testScriptPath = path.join(
      process.cwd(),
      'tests/helpers/command-for-integration-tests.sh',
    )
    const script = dedent`
      !!${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"
    `
    const parsed = executeCommands(parseCommands(parseContent(script)))

    const cleanedResult = parsed.map(line => {
      if ('isCallingCommand' in line) {
        const { isCallingCommand, ...rest } = line
        return rest
      }
      return line
    })

    expect(cleanedResult).toEqual([
      {
        type: { name: 'command', attrs: { name: testScriptPath } },
        input: `${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"`,
        commandName: testScriptPath,
        exit: {
          name: 'exit',
          attrs: {
            status: 'failure',
            code: '42',
          },
        },
        stdout: 'hello world\n',
        stderr: 'error message\n',
      },
    ])
  })

  it('should throw error for compound commands in parse phase', () => {
    const script = dedent`
      !!echo hello | grep hello
    `
    const parsed = parseContent(script)

    // parseContent succeeds
    expect(parsed).toEqual([
      {
        type: 'command',
        input: 'echo hello | grep hello',
      },
    ])

    // parseCommands throws
    expect(() => parseCommands(parsed)).toThrow(
      'Only simple commands are allowed',
    )
  })
})
