import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCommand, parseCommands } from '../src/parse-commands'
import { UnparsedCommandLine } from '../src/types'
import { existsSync } from 'fs'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

describe('parseCommand', () => {
  const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

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
      input: 'echo "hello world"',
    }
    const result = parseCommand(unparsed, 'tag-composer')
    expect(result.commandName).toBe('echo')

    mockExistsSync.mockReturnValue(true)
    const unparsed2: UnparsedCommandLine = {
      type: 'command',
      input: 'tag-composer file.md',
    }
    const result2 = parseCommand(unparsed2, 'tag-composer')
    expect(result2.commandName).toBe('tag-composer')
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

  describe('calling command validation', () => {
    it('should validate calling command with valid markdown file', async () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer readme.md',
      }
      const result = await parseCommand(unparsed, 'tag-composer')
      expect(result.commandName).toBe('tag-composer')
    })

    it('should reject calling command with missing file', async () => {
      mockExistsSync.mockReturnValue(false)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer missing.md',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).toThrow(
        "Invalid calling command: Error: File 'missing.md' not found",
      )
    })

    it('should reject calling command with non-markdown file', async () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer file.txt',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).toThrow(
        "Invalid calling command: Error: File 'file.txt' is not a markdown file (must end with .md)",
      )
    })

    it('should reject calling command with no arguments', async () => {
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).toThrow(
        "Invalid calling command: error: missing required argument 'file'",
      )
    })

    it('should reject calling command with too many arguments', async () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer file1.md file2.md',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).toThrow(
        'Invalid calling command: error: too many arguments',
      )
    })

    it('should not validate non-calling commands', async () => {
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'echo "hello"',
      }
      const result = await parseCommand(unparsed, 'tag-composer')
      expect(result.commandName).toBe('echo')
      expect(mockExistsSync).not.toHaveBeenCalled()
    })

    it('should validate a command with a file path containing spaces', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer "my file.md"',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith('my file.md')
    })

    it('should validate a command with single quotes', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: "tag-composer 'another file.md'",
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith('another file.md')
    })

    it('should accept file with uppercase .MD extension', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer file.MD',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith('file.MD')
    })

    it('should handle escaped quotes in file names', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer "file\\"with\\"quotes.md"',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith('file"with"quotes.md')
    })

    it('should validate relative paths', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer ./docs/readme.md',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith('./docs/readme.md')
    })

    it('should validate absolute paths', () => {
      mockExistsSync.mockReturnValue(true)
      const unparsed: UnparsedCommandLine = {
        type: 'command',
        input: 'tag-composer /home/user/project/readme.md',
      }
      expect(() => parseCommand(unparsed, 'tag-composer')).not.toThrow()
      expect(mockExistsSync).toHaveBeenCalledWith(
        '/home/user/project/readme.md',
      )
    })
  })
})

describe('parseCommands', () => {
  const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse multiple lines with mixed content', async () => {
    const lines = [
      { type: 'text' as const, content: 'Some text' },
      { type: 'command' as const, input: 'echo "hello"' },
      { type: 'text' as const, content: 'More text' },
      { type: 'command' as const, input: 'ls -la' },
    ]

    const result = await parseCommands(lines)

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

  it('should handle nested children', async () => {
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

    const result = await parseCommands(lines)

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

    mockExistsSync.mockReturnValue(true)
    const lines2 = [
      { type: 'command' as const, input: 'tag-composer file.md' },
      { type: 'command' as const, input: 'echo "hello"' },
    ]

    const result2 = parseCommands(lines2, 'tag-composer')

    expect(result2[0]).toMatchObject({
      commandName: 'tag-composer',
    })
    expect(result2[1]).toMatchObject({
      commandName: 'echo',
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
