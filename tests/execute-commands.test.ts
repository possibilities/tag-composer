import { describe, it, expect } from 'vitest'
import { executeCommand, executeCommands } from '../src/execute-commands'
import { CommandLine } from '../src/types'

describe('executeCommand', () => {
  it('should execute successful command and capture stdout', () => {
    const result = executeCommand('echo "hello world"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('hello world\n')
    expect(result.stderr).toBe('')
  })

  it('should capture stderr for commands that write to stderr', () => {
    const result = executeCommand('sh -c "echo error >&2"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('error\n')
  })

  it('should capture non-zero exit codes', () => {
    const result = executeCommand('exit 42')

    expect(result.statusCode).toBe(42)
  })

  it('should handle commands that fail', () => {
    const result = executeCommand('false')

    expect(result.statusCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('should handle commands with both stdout and stderr', () => {
    const result = executeCommand('sh -c "echo stdout && echo stderr >&2"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('stdout\n')
    expect(result.stderr).toBe('stderr\n')
  })

  it('should handle commands that do not exist', () => {
    const result = executeCommand('nonexistentcommand12345')

    expect(result.statusCode).not.toBe(0)
    expect(result.stderr.toLowerCase()).toMatch(
      /command not found|permission denied|not found/,
    )
  })
})

describe('executeCommands', () => {
  it('should execute commands in a flat array', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'hello',
      },
      {
        type: { name: 'command', attrs: { name: 'echo' } },
        input: 'echo "test output"',
        commandName: 'echo',
        isCallingCommand: false,
      } as CommandLine,
      {
        type: { name: 'command', attrs: { name: 'echo' } },
        input: 'echo "another test"',
        commandName: 'echo',
        isCallingCommand: false,
      } as CommandLine,
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'text',
      content: 'hello',
    })

    expect(result[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      input: 'echo "test output"',
      commandName: 'echo',
      exit: {
        name: 'exit',
        attrs: {
          status: 'success',
          code: '0',
        },
      },
      stdout: 'test output\n',
      stderr: '',
    })

    expect(result[2]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      input: 'echo "another test"',
      commandName: 'echo',
      exit: {
        name: 'exit',
        attrs: {
          status: 'success',
          code: '0',
        },
      },
      stdout: 'another test\n',
      stderr: '',
    })
  })

  it('should execute commands in nested structures', () => {
    const lines = [
      {
        type: 'section',
        title: 'Test Section',
        children: [
          {
            type: { name: 'command', attrs: { name: 'echo' } },
            input: 'echo "nested command"',
            commandName: 'echo',
            isCallingCommand: false,
          } as CommandLine,
          {
            type: 'text' as const,
            content: 'nested text',
          },
        ],
      },
      {
        type: { name: 'command', attrs: { name: 'echo' } },
        input: 'echo "root level"',
        commandName: 'echo',
        isCallingCommand: false,
      } as CommandLine,
    ]

    const result = executeCommands(lines)

    expect(result[0].type).toBe('section')
    expect(result[0].children[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      input: 'echo "nested command"',
      exit: {
        name: 'exit',
        attrs: {
          status: 'success',
          code: '0',
        },
      },
      stdout: 'nested command\n',
      stderr: '',
    })
    expect(result[0].children[1]).toEqual({
      type: 'text',
      content: 'nested text',
    })

    expect(result[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      input: 'echo "root level"',
      exit: {
        name: 'exit',
        attrs: {
          status: 'success',
          code: '0',
        },
      },
      stdout: 'root level\n',
      stderr: '',
    })
  })

  it('should handle mixed content in nested structures', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'start',
      },
      {
        type: 'group',
        children: [
          {
            type: { name: 'command', attrs: { name: 'true' } },
            input: 'true',
            commandName: 'true',
            isCallingCommand: false,
          } as CommandLine,
          {
            type: { name: 'command', attrs: { name: 'false' } },
            input: 'false',
            commandName: 'false',
            isCallingCommand: false,
          } as CommandLine,
        ],
      },
      {
        type: 'text' as const,
        content: 'end',
      },
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'text',
      content: 'start',
    })

    expect(result[1].children[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'true' } },
      input: 'true',
      commandName: 'true',
      exit: {
        name: 'exit',
        attrs: {
          status: 'success',
          code: '0',
        },
      },
      stdout: '',
      stderr: '',
    })

    expect(result[1].children[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'false' } },
      input: 'false',
      commandName: 'false',
      exit: {
        name: 'exit',
        attrs: {
          status: 'failure',
          code: '1',
        },
      },
      stdout: '',
      stderr: '',
    })

    expect(result[2]).toEqual({
      type: 'text',
      content: 'end',
    })
  })
})
