import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parse-content'
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
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'text',
        content: 'hello world',
      },
      {
        type: 'command',
        content: 'echo "test"',
        ast: expect.any(Object),
        statusCode: 0,
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

  it('should parse and execute complex command', () => {
    const testScriptPath = path.join(
      process.cwd(),
      'tests/helpers/command-for-integration-tests.sh',
    )
    const script = dedent`
      !!${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"
    `
    const parsed = parseContent(script)

    expect(parsed).toEqual([
      {
        type: 'command',
        content: `${testScriptPath} --exit-code 42 --stdout "hello world" --stderr "error message"`,
        ast: expect.any(Object),
        statusCode: 42,
        stdout: 'hello world\n',
        stderr: 'error message\n',
      },
    ])
  })

  it('should throw error for compound commands', () => {
    const script = dedent`
      !!echo hello | grep hello
    `
    expect(() => parseContent(script)).toThrow(
      'Parse error at line 1: Only simple commands are allowed, found Pipeline',
    )
  })
})
