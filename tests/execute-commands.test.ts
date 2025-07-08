import { describe, it, expect } from 'vitest'
import { executeCommands } from '../src/execute-commands'
import { CommandLine, XmlElement } from '../src/types'
import { spawnSync } from 'child_process'

function executeCommand(command: string) {
  const result = spawnSync('sh', ['-c', command], {
    encoding: 'utf8',
    shell: false,
  })

  return {
    statusCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

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

    expect(result.statusCode).toBe(127)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('nonexistentcommand12345')
  })
})

describe('executeCommands', () => {
  it('should execute commands in a flat array', () => {
    const lines = [
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'hello' }],
      } as XmlElement,
      {
        type: 'element',
        name: 'command',
        attributes: { name: 'echo' },
        elements: [
          {
            type: 'element',
            name: 'input',
            elements: [{ type: 'text', text: 'echo "test output"' }],
          },
        ],
        commandName: 'echo',
      } as CommandLine,
      {
        type: 'element',
        name: 'command',
        attributes: { name: 'echo' },
        elements: [
          {
            type: 'element',
            name: 'input',
            elements: [{ type: 'text', text: 'echo "another test"' }],
          },
        ],
        commandName: 'echo',
      } as CommandLine,
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'element',
      name: 'text',
      elements: [{ type: 'text', text: 'hello' }],
    })

    expect(result[1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
      elements: expect.arrayContaining([
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'echo "test output"' }],
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
          elements: [{ type: 'text', text: 'test output' }],
        },
        {
          type: 'element',
          name: 'stderr',
        },
      ]),
    })

    expect(result[2]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
      elements: expect.arrayContaining([
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'echo "another test"' }],
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
          elements: [{ type: 'text', text: 'another test' }],
        },
        {
          type: 'element',
          name: 'stderr',
        },
      ]),
    })
  })

  it('should execute commands in nested structures', () => {
    const lines = [
      {
        type: 'element',
        name: 'section',
        elements: [
          {
            type: 'element',
            name: 'command',
            attributes: { name: 'echo' },
            elements: [
              {
                type: 'element',
                name: 'input',
                elements: [{ type: 'text', text: 'echo "nested command"' }],
              },
            ],
            commandName: 'echo',
          } as CommandLine,
          {
            type: 'element',
            name: 'text',
            elements: [{ type: 'text', text: 'nested text' }],
          } as XmlElement,
        ],
      } as XmlElement,
      {
        type: 'element',
        name: 'command',
        attributes: { name: 'echo' },
        elements: [
          {
            type: 'element',
            name: 'input',
            elements: [{ type: 'text', text: 'echo "root level"' }],
          },
        ],
        commandName: 'echo',
      } as CommandLine,
    ]

    const result = executeCommands(lines)

    expect(result[0].type).toBe('element')
    expect(result[0].name).toBe('section')
    expect(result[0].elements![0]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      elements: expect.arrayContaining([
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'echo "nested command"' }],
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
          elements: [{ type: 'text', text: 'nested command' }],
        },
      ]),
    })
    expect(result[0].elements![1]).toEqual({
      type: 'element',
      name: 'text',
      elements: [{ type: 'text', text: 'nested text' }],
    })

    expect(result[1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      elements: expect.arrayContaining([
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'echo "root level"' }],
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
          elements: [{ type: 'text', text: 'root level' }],
        },
      ]),
    })
  })

  it('should handle mixed content in nested structures', () => {
    const lines = [
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'start' }],
      } as XmlElement,
      {
        type: 'element',
        name: 'group',
        elements: [
          {
            type: 'element',
            name: 'command',
            attributes: { name: 'true' },
            elements: [
              {
                type: 'element',
                name: 'input',
                elements: [{ type: 'text', text: 'true' }],
              },
            ],
            commandName: 'true',
          } as CommandLine,
          {
            type: 'element',
            name: 'command',
            attributes: { name: 'false' },
            elements: [
              {
                type: 'element',
                name: 'input',
                elements: [{ type: 'text', text: 'false' }],
              },
            ],
            commandName: 'false',
          } as CommandLine,
        ],
      } as XmlElement,
      {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: 'end' }],
      } as XmlElement,
    ]

    const result = executeCommands(lines)

    expect(result[0]).toEqual({
      type: 'element',
      name: 'text',
      elements: [{ type: 'text', text: 'start' }],
    })

    expect(result[1].elements![0]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'true' },
      elements: expect.arrayContaining([
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
        },
        {
          type: 'element',
          name: 'stderr',
        },
      ]),
    })

    expect(result[1].elements![1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'false' },
      elements: expect.arrayContaining([
        {
          type: 'element',
          name: 'exit',
          attributes: {
            status: 'failure',
            code: '1',
          },
        },
        {
          type: 'element',
          name: 'stdout',
        },
        {
          type: 'element',
          name: 'stderr',
        },
      ]),
    })

    expect(result[2]).toEqual({
      type: 'element',
      name: 'text',
      elements: [{ type: 'text', text: 'end' }],
    })
  })
})
