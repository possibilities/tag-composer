import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parse-content'
import { validateCommands } from '../src/validate-commands'
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

  it('should parse commands starting with !! and execute them', () => {
    const script = dedent`
      hello world
      !!echo "test"
      goodbye world
    `
    const parsed = executeCommands(validateCommands(parseContent(script)))

    const parsedWithoutAst = parsed.map(line => {
      if ('ast' in line && 'isCallingCommand' in line) {
        const { ast, isCallingCommand, ...rest } = line
        return rest
      }
      return line
    })

    expect(parsedWithoutAst).toEqual([
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

  it('should throw error for invalid bash syntax', () => {
    const script = dedent`
      hello
      !!echo "unclosed quote
      world
    `
    expect(() => parseContent(script)).toThrow(
      /Parse error at line 2: Invalid bash syntax/,
    )
  })

  it('should identify calling command when names match', () => {
    const script = dedent`
      !!echo "first command"
      !!grep "pattern"
      !!echo "third command"
    `
    const parsed = parseContent(script, 'echo')

    expect(parsed[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: true,
    })

    expect(parsed[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'grep' } },
      commandName: 'grep',
      isCallingCommand: false,
    })

    expect(parsed[2]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: true,
    })
  })

  it('should set isCallingCommand to false when no calling command provided', () => {
    const script = dedent`
      !!echo "test"
      !!grep "pattern"
    `
    const parsed = parseContent(script)

    expect(parsed[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      isCallingCommand: false,
    })

    expect(parsed[1]).toMatchObject({
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
    const parsed = executeCommands(validateCommands(parseContent(script)))

    const parsedWithoutAst = parsed.map(line => {
      if ('ast' in line && 'isCallingCommand' in line) {
        const { ast, isCallingCommand, ...rest } = line
        return rest
      }
      return line
    })

    expect(parsedWithoutAst).toEqual([
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

  it('should throw error for compound commands', () => {
    const script = dedent`
      !!echo hello | grep hello
    `
    expect(() => validateCommands(parseContent(script))).toThrow(
      'Only simple commands are allowed, found Pipeline',
    )
  })
})
