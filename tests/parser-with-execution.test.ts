import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser'
import path from 'path'

describe('parse with execution', () => {
  const testScriptPath = path.join(
    process.cwd(),
    'tests/helpers/command-for-integration-tests.sh',
  )

  it('should execute commands when execute flag is true', () => {
    const script = dedent`
      !!echo "test output"
    `
    const parsed = parse(script, true)

    expect(parsed).toEqual([
      {
        type: 'command',
        content: 'echo "test output"',
        ast: expect.any(Object),
        statusCode: 0,
        stdout: 'test output\n',
        stderr: '',
      },
    ])
  })

  it('should not execute commands when execute flag is false', () => {
    const script = dedent`
      !!echo "test output"
    `
    const parsed = parse(script, false)

    expect(parsed).toEqual([
      {
        type: 'command',
        content: 'echo "test output"',
        ast: expect.any(Object),
      },
    ])
  })

  it('should not execute commands by default', () => {
    const script = dedent`
      !!echo "test output"
    `
    const parsed = parse(script)

    expect(parsed).toEqual([
      {
        type: 'command',
        content: 'echo "test output"',
        ast: expect.any(Object),
      },
    ])
  })

  it('should capture exit codes correctly', () => {
    const script = dedent`
      !!${testScriptPath} --exit-code 42 --stdout "hello" --stderr "error"
    `
    const parsed = parse(script, true)

    expect(parsed).toEqual([
      {
        type: 'command',
        content: `${testScriptPath} --exit-code 42 --stdout "hello" --stderr "error"`,
        ast: expect.any(Object),
        statusCode: 42,
        stdout: 'hello\n',
        stderr: 'error\n',
      },
    ])
  })

  it('should handle multiple commands with mixed text', () => {
    const script = dedent`
      Some text
      !!echo "first"
      More text
      !!echo "second"
    `
    const parsed = parse(script, true)

    expect(parsed).toEqual([
      {
        type: 'text',
        content: 'Some text',
      },
      {
        type: 'command',
        content: 'echo "first"',
        ast: expect.any(Object),
        statusCode: 0,
        stdout: 'first\n',
        stderr: '',
      },
      {
        type: 'text',
        content: 'More text',
      },
      {
        type: 'command',
        content: 'echo "second"',
        ast: expect.any(Object),
        statusCode: 0,
        stdout: 'second\n',
        stderr: '',
      },
    ])
  })
})
