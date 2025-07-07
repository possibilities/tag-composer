import { describe, it, expect } from 'vitest'
import { parseCommand, parseCommands } from '../src/parse-commands'
import { UnparsedCommandLine } from '../src/types'

describe('parseCommand', () => {
  it('should parse a simple echo command', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "hello"',
    }
    const result = parseCommand(unparsed)
    expect(result.commandName).toBe('echo')
    expect(result.type).toEqual({ name: 'command', attrs: { name: 'echo' } })
    expect(result.input).toBe('echo "hello"')
  })

  it('should parse a command with no arguments', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'ls',
    }
    const result = parseCommand(unparsed)
    expect(result.commandName).toBe('ls')
    expect(result.type).toEqual({ name: 'command', attrs: { name: 'ls' } })
  })

  it('should handle callingCommandName', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'mycommand arg1 arg2',
    }
    const result = parseCommand(unparsed, 'mycommand')
    expect(result.isCallingCommand).toBe(true)

    const result2 = parseCommand(unparsed, 'othercommand')
    expect(result2.isCallingCommand).toBe(false)
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
      input: 'echo "hello" > output.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with redirections using <', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'cat < input.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with output appending >>', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'echo "hello" >> output.txt',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with stderr redirection', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'command 2> error.log',
    }
    expect(() => parseCommand(unparsed)).toThrow('Redirections are not allowed')
  })

  it('should reject commands with combined output redirection', () => {
    const unparsed: UnparsedCommandLine = {
      type: 'command',
      input: 'command &> all.log',
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
      input: 'echo "hello" | grep "h"',
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
      input: '(echo "hello")',
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
      input: 'echo "unclosed string',
    }
    expect(() => parseCommand(unparsed)).toThrow('Invalid bash syntax')
  })
})

describe('parseCommands', () => {
  it('should parse multiple lines with mixed content', () => {
    const lines = [
      { type: 'text' as const, content: 'Some text' },
      { type: 'command' as const, input: 'echo "hello"' },
      { type: 'text' as const, content: 'More text' },
      { type: 'command' as const, input: 'ls -la' },
    ]

    const result = parseCommands(lines)

    expect(result[0]).toEqual({ type: 'text', content: 'Some text' })
    expect(result[1]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
      input: 'echo "hello"',
    })
    expect(result[2]).toEqual({ type: 'text', content: 'More text' })
    expect(result[3]).toMatchObject({
      type: { name: 'command', attrs: { name: 'ls' } },
      commandName: 'ls',
      input: 'ls -la',
    })
  })

  it('should handle nested children', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'Parent',
        children: [
          { type: 'command' as const, input: 'echo "child"' },
          { type: 'text' as const, content: 'Child text' },
        ],
      },
    ]

    const result = parseCommands(lines)

    expect(result[0].type).toBe('text')
    expect(result[0].children?.[0]).toMatchObject({
      type: { name: 'command', attrs: { name: 'echo' } },
      commandName: 'echo',
    })
    expect(result[0].children?.[1]).toEqual({
      type: 'text',
      content: 'Child text',
    })
  })

  it('should propagate callingCommandName to all commands', () => {
    const lines = [
      { type: 'command' as const, input: 'test arg1' },
      { type: 'command' as const, input: 'other arg2' },
      { type: 'command' as const, input: 'test arg3' },
    ]

    const result = parseCommands(lines, 'test')

    expect(result[0]).toMatchObject({
      commandName: 'test',
      isCallingCommand: true,
    })
    expect(result[1]).toMatchObject({
      commandName: 'other',
      isCallingCommand: false,
    })
    expect(result[2]).toMatchObject({
      commandName: 'test',
      isCallingCommand: true,
    })
  })

  it('should throw error with command context on parse failure', () => {
    const lines = [
      { type: 'command' as const, input: 'echo "hello" > output.txt' },
    ]

    expect(() => parseCommands(lines)).toThrow(
      'Error parsing command "echo "hello" > output.txt": Redirections are not allowed',
    )
  })
})
