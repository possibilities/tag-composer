import { describe, it, expect } from 'vitest'
import { validateCommand, validateCommands } from '../src/validate-commands'

describe('validateCommand', () => {
  it('should accept a simple command', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: {
            text: 'echo',
            type: 'Word',
          },
          suffix: [
            {
              text: 'hello',
              type: 'Word',
            },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).not.toThrow()
  })

  it('should accept a command with no arguments', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: {
            text: 'ls',
            type: 'Word',
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).not.toThrow()
  })

  it('should accept a command with assignment prefix', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: {
            text: 'env',
            type: 'Word',
          },
          prefix: [
            {
              type: 'AssignmentWord',
              text: 'VAR=value',
            },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).not.toThrow()
  })

  it('should reject invalid AST', () => {
    expect(() => validateCommand(null as unknown as { type: string })).toThrow(
      'Invalid AST',
    )
    expect(() =>
      validateCommand(undefined as unknown as { type: string }),
    ).toThrow('Invalid AST')
    expect(() =>
      validateCommand('string' as unknown as { type: string }),
    ).toThrow('Invalid AST')
  })

  it('should reject non-Script root node', () => {
    const ast = {
      type: 'Command',
      name: { text: 'echo', type: 'Word' },
    }
    expect(() => validateCommand(ast)).toThrow('Root node must be Script')
  })

  it('should reject Script without commands array', () => {
    const ast = {
      type: 'Script',
    }
    expect(() => validateCommand(ast)).toThrow(
      'Script must have commands array',
    )
  })

  it('should reject multiple commands', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: { text: 'echo', type: 'Word' },
        },
        {
          type: 'Command',
          name: { text: 'ls', type: 'Word' },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only single commands are allowed',
    )
  })

  it('should reject pipelines', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Pipeline',
          commands: [
            { type: 'Command', name: { text: 'echo', type: 'Word' } },
            { type: 'Command', name: { text: 'grep', type: 'Word' } },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found Pipeline',
    )
  })

  it('should reject logical expressions with AND', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'LogicalExpression',
          op: 'and',
          left: { type: 'Command', name: { text: 'echo', type: 'Word' } },
          right: { type: 'Command', name: { text: 'ls', type: 'Word' } },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found LogicalExpression',
    )
  })

  it('should reject logical expressions with OR', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'LogicalExpression',
          op: 'or',
          left: { type: 'Command', name: { text: 'echo', type: 'Word' } },
          right: { type: 'Command', name: { text: 'ls', type: 'Word' } },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found LogicalExpression',
    )
  })

  it('should reject subshells', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Subshell',
          list: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'echo', type: 'Word' } },
            ],
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found Subshell',
    )
  })

  it('should reject redirections in suffix', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: { text: 'echo', type: 'Word' },
          suffix: [
            { text: 'hello', type: 'Word' },
            {
              type: 'Redirect',
              op: { type: 'great', text: '>' },
              file: { type: 'Word', text: 'output.txt' },
            },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow('Redirections are not allowed')
  })

  it('should reject redirections in prefix', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Command',
          name: { text: 'cat', type: 'Word' },
          prefix: [
            {
              type: 'Redirect',
              op: { type: 'less', text: '<' },
              file: { type: 'Word', text: 'input.txt' },
            },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow('Redirections are not allowed')
  })

  it('should reject compound lists', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'CompoundList',
          commands: [
            { type: 'Command', name: { text: 'echo', type: 'Word' } },
            { type: 'Command', name: { text: 'ls', type: 'Word' } },
          ],
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found CompoundList',
    )
  })

  it('should reject for loops', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'For',
          name: { text: 'i', type: 'Name' },
          wordlist: [
            { text: '1', type: 'Word' },
            { text: '2', type: 'Word' },
          ],
          do: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'echo', type: 'Word' } },
            ],
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found For',
    )
  })

  it('should reject if statements', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'If',
          clause: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'test', type: 'Word' } },
            ],
          },
          then: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'echo', type: 'Word' } },
            ],
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found If',
    )
  })

  it('should reject while loops', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'While',
          clause: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'true', type: 'Word' } },
            ],
          },
          do: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'echo', type: 'Word' } },
            ],
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found While',
    )
  })

  it('should reject function definitions', () => {
    const ast = {
      type: 'Script',
      commands: [
        {
          type: 'Function',
          name: { text: 'myFunc', type: 'Name' },
          body: {
            type: 'CompoundList',
            commands: [
              { type: 'Command', name: { text: 'echo', type: 'Word' } },
            ],
          },
        },
      ],
    }
    expect(() => validateCommand(ast)).toThrow(
      'Only simple commands are allowed, found Function',
    )
  })
})

describe('validateCommands', () => {
  it('should validate flat array of commands', () => {
    const lines = [
      {
        type: 'text',
        content: 'hello',
      },
      {
        type: 'command',
        content: 'echo test',
        commandName: 'echo',
        ast: {
          type: 'Script',
          commands: [
            {
              type: 'Command',
              name: { text: 'echo', type: 'Word' },
              suffix: [{ text: 'test', type: 'Word' }],
            },
          ],
        },
      },
    ]

    expect(() => validateCommands(lines)).not.toThrow()
  })

  it('should validate nested structures', () => {
    const lines = [
      {
        type: 'section',
        name: 'Main',
        children: [
          {
            type: 'command',
            content: 'echo nested',
            commandName: 'echo',
            ast: {
              type: 'Script',
              commands: [
                {
                  type: 'Command',
                  name: { text: 'echo', type: 'Word' },
                  suffix: [{ text: 'nested', type: 'Word' }],
                },
              ],
            },
          },
          {
            type: 'subsection',
            name: 'Sub',
            children: [
              {
                type: 'command',
                content: 'ls -la',
                commandName: 'ls',
                ast: {
                  type: 'Script',
                  commands: [
                    {
                      type: 'Command',
                      name: { text: 'ls', type: 'Word' },
                      suffix: [{ text: '-la', type: 'Word' }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ]

    expect(() => validateCommands(lines)).not.toThrow()
  })

  it('should throw error for invalid commands in nested structures', () => {
    const lines = [
      {
        type: 'section',
        children: [
          {
            type: 'command',
            content: 'echo hello | grep hello',
            commandName: 'Pipeline',
            ast: {
              type: 'Script',
              commands: [
                {
                  type: 'Pipeline',
                  commands: [],
                },
              ],
            },
          },
        ],
      },
    ]

    expect(() => validateCommands(lines)).toThrow(
      'Only simple commands are allowed, found Pipeline',
    )
  })
})
