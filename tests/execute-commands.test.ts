import { describe, it, expect } from 'vitest'
import { executeCommand, executeCommands } from '../src/execute-commands'

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
        type: 'text',
        content: 'hello',
      },
      {
        type: 'command',
        content: 'echo "test output"',
        commandName: 'echo',
      },
      {
        type: 'command',
        content: 'echo "another test"',
        commandName: 'echo',
      },
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'text',
      content: 'hello',
    })

    expect(result[1]).toMatchObject({
      type: 'command',
      content: 'echo "test output"',
      commandName: 'echo',
      statusCode: 0,
      stdout: 'test output\n',
      stderr: '',
    })

    expect(result[2]).toMatchObject({
      type: 'command',
      content: 'echo "another test"',
      commandName: 'echo',
      statusCode: 0,
      stdout: 'another test\n',
      stderr: '',
    })
  })

  it('should execute commands in nested structures', () => {
    const lines = [
      {
        type: 'section',
        name: 'Main',
        children: [
          {
            type: 'command',
            content: 'echo "nested command"',
            commandName: 'echo',
          },
          {
            type: 'subsection',
            name: 'Sub',
            children: [
              {
                type: 'command',
                content: 'echo "deeply nested"',
                commandName: 'echo',
              },
            ],
          },
        ],
      },
    ]

    const result = executeCommands(lines)

    expect(result[0].type).toBe('section')
    expect(result[0].children[0]).toMatchObject({
      type: 'command',
      content: 'echo "nested command"',
      statusCode: 0,
      stdout: 'nested command\n',
      stderr: '',
    })

    expect(result[0].children[1].type).toBe('subsection')
    expect(result[0].children[1].children[0]).toMatchObject({
      type: 'command',
      content: 'echo "deeply nested"',
      statusCode: 0,
      stdout: 'deeply nested\n',
      stderr: '',
    })
  })

  it('should handle mixed content in nested structures', () => {
    const lines = [
      {
        type: 'text',
        content: 'start',
      },
      {
        type: 'group',
        children: [
          {
            type: 'text',
            content: 'inside group',
          },
          {
            type: 'command',
            content: 'false',
            commandName: 'false',
          },
        ],
      },
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'text',
      content: 'start',
    })

    expect(result[1].children[0]).toEqual({
      type: 'text',
      content: 'inside group',
    })

    expect(result[1].children[1]).toMatchObject({
      type: 'command',
      content: 'false',
      commandName: 'false',
      statusCode: 1,
      stdout: '',
      stderr: '',
    })
  })
})
