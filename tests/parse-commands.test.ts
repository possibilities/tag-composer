import { describe, it, expect } from 'vitest'
import { parseCommands } from '../src/parse-commands'
import { UnparsedCommandLine, CommandLine } from '../src/types'
import bashParse from 'bash-parser'

function parseCommand(unparsedCommand: UnparsedCommandLine): CommandLine {
  let ast: any
  try {
    ast = bashParse(unparsedCommand.input)
  } catch (error) {
    throw new Error(
      `Invalid bash syntax - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!ast || typeof ast !== 'object') {
    throw new Error('Invalid AST')
  }

  if (ast.type !== 'Script') {
    throw new Error('Root node must be Script')
  }

  if (!ast.commands || !Array.isArray(ast.commands)) {
    throw new Error('Script must have commands array')
  }

  if (ast.commands.length !== 1) {
    throw new Error('Only single commands are allowed')
  }

  const command = ast.commands[0]

  if (command.type !== 'Command') {
    throw new Error(`Only simple commands are allowed`)
  }

  if (command.async) {
    throw new Error('Background jobs are not allowed')
  }

  if (command.prefix) {
    for (const prefixItem of command.prefix) {
      if (prefixItem.type === 'Redirect') {
        throw new Error('Redirections are not allowed')
      }
    }
  }

  if (command.suffix) {
    for (const suffixItem of command.suffix) {
      if (suffixItem.type === 'Redirect') {
        throw new Error('Redirections are not allowed')
      }

      if (
        suffixItem.type === 'dless' ||
        suffixItem.type === 'dlessdash' ||
        suffixItem.type === 'tless'
      ) {
        throw new Error('Redirections are not allowed')
      }

      if (suffixItem.expansion && Array.isArray(suffixItem.expansion)) {
        for (const exp of suffixItem.expansion) {
          if (exp.type === 'CommandExpansion') {
            throw new Error('Command substitution is not allowed')
          }
        }
      }

      if (suffixItem.type === 'Word' && typeof suffixItem.text === 'string') {
        if (suffixItem.text.includes('$(') || suffixItem.text.includes('`')) {
          throw new Error('Command substitution is not allowed')
        }
      }
    }
  }

  const commandName = command.name?.text || 'unknown'

  return {
    type: { name: 'command', attributes: { name: commandName } },
    input: unparsedCommand.input,
    commandName,
    ast,
    children: unparsedCommand.children,
  }
}

describe('parseCommand', () => {
  it('should parse a simple echo command', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "hello world"',
    }
    const result = parseCommand(unparsed)
    expect(result).toMatchObject({
      type: { name: 'command', attributes: { name: 'echo' } },
      input: 'echo "hello world"',
      commandName: 'echo',
      ast: expect.any(Object),
    })
  })

  it('should parse a command with no arguments', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'pwd',
    }
    const result = parseCommand(unparsed)
    expect(result.commandName).toBe('pwd')
  })

  it('should handle callingCommandName', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'tag-composer file.md',
    }
    const result = parseCommand(unparsed)
    expect(result.commandName).toBe('tag-composer')
  })

  it('should reject empty commands', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: '',
    }
    expect(() => parseCommand(unparsed)).toThrow('Invalid bash syntax')
  })

  it('should reject commands with redirections using >', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "test" > file.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with redirections using <', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'cat < file.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with output appending >>', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "test" >> file.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with stderr redirection', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "test" 2> error.log',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with combined output redirection', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "test" &> all.log',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only single commands are allowed',
    )
  })

  it('should reject commands with here documents', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'cat << EOF',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject pipes', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "hello" | grep "world"',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only simple commands are allowed',
    )
  })

  it('should reject command sequences with &&', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "first" && echo "second"',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only simple commands are allowed',
    )
  })

  it('should reject command sequences with ||', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'false || echo "failed"',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only simple commands are allowed',
    )
  })

  it('should reject command sequences with ;', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "first"; echo "second"',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only single commands are allowed',
    )
  })

  it('should reject subshells', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: '(echo "in subshell")',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Only simple commands are allowed',
    )
  })

  it('should reject background jobs with &', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'sleep 10 &',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Background jobs are not allowed',
    )
  })

  it('should reject command substitution with backticks', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo `date`',
    }
    expect(() => parseCommand(unparsed)).toThrow(
      'Command substitution is not allowed',
    )
  })

  it('should reject invalid syntax', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "unclosed',
    }
    expect(() => parseCommand(unparsed)).toThrow('Invalid bash syntax')
  })
})

describe('parseCommands', () => {
  it('should parse multiple lines with mixed content', async () => {
    const lines = [
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'Some text' }],
          },
        ],
      },
      { type: 'command' as const, input: 'echo "hello"' },
      {
        type: 'element',
        name: 'text',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'More text' }],
          },
        ],
      },
      { type: 'command' as const, input: 'ls -la' },
    ]

    const result = await parseCommands(lines)

    expect(result[0]).toEqual({
      type: 'element',
      name: 'text',
      elements: [
        {
          type: 'element',
          name: 'content',
          elements: [{ type: 'text', text: 'Some text' }],
        },
      ],
    })
    expect(result[1]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
      elements: [
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'echo "hello"' }],
        },
      ],
    })
    expect(result[2]).toEqual({
      type: 'element',
      name: 'text',
      elements: [
        {
          type: 'element',
          name: 'content',
          elements: [{ type: 'text', text: 'More text' }],
        },
      ],
    })
    expect(result[3]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'ls' },
      commandName: 'ls',
      elements: [
        {
          type: 'element',
          name: 'input',
          elements: [{ type: 'text', text: 'ls -la' }],
        },
      ],
    })
  })

  it('should handle nested children', async () => {
    const lines = [
      {
        type: 'element',
        name: 'section',
        elements: [
          { type: 'command' as const, input: 'echo "child"' },
          {
            type: 'element',
            name: 'text',
            elements: [
              {
                type: 'element',
                name: 'content',
                elements: [{ type: 'text', text: 'Child text' }],
              },
            ],
          },
        ],
      },
    ]

    const result = await parseCommands(lines)

    expect(result[0].type).toBe('element')
    expect(result[0].name).toBe('section')
    expect(result[0].elements?.[0]).toMatchObject({
      type: 'element',
      name: 'command',
      attributes: { name: 'echo' },
      commandName: 'echo',
    })
    expect(result[0].elements?.[1]).toEqual({
      type: 'element',
      name: 'text',
      elements: [
        {
          type: 'element',
          name: 'content',
          elements: [{ type: 'text', text: 'Child text' }],
        },
      ],
    })
  })

  it('should propagate callingCommandName to all commands', () => {
    const lines = [
      { type: 'command' as const, input: 'echo "hello"' },
      { type: 'command' as const, input: 'grep pattern' },
      { type: 'command' as const, input: 'echo "world"' },
    ]

    const result = parseCommands(lines, 'some-other-command')

    expect(result[0]).toMatchObject({
      commandName: 'echo',
    })
    expect(result[1]).toMatchObject({
      commandName: 'grep',
    })
    expect(result[2]).toMatchObject({
      commandName: 'echo',
    })
  })

  it('should throw error with command context on parse failure', () => {
    const lines = [
      { type: 'text' as const, content: 'Some text' },
      { type: 'command' as const, input: 'echo "valid"' },
      { type: 'command' as const, input: 'echo | grep' },
    ]

    expect(() => parseCommands(lines)).toThrow(
      'Error parsing command "echo | grep"',
    )
  })
})
