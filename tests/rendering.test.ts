import { describe, it, expect } from 'vitest'
import dedent from 'dedent'

import { renderToXml } from '../src/renderer.js'
import type { ParsedFsInfo, ParsedNode } from '../src/types.js'

describe('renderToXml - Basic Rendering', () => {
  it('renders simple command', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'command',
          commandName: 'echo',
          input: 'echo hello',
          stdout: 'hello',
          stderr: '',
          exitCode: 0,
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <echo>
        <input>echo hello</input>
        <stdout>hello</stdout>
        <success code="0" />
      </echo>
    `

    expect(result).toBe(expected)
  })

  it('renders command with empty stdout', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'command',
          commandName: 'echo',
          input: 'echo',
          stdout: '',
          stderr: '',
          exitCode: 0,
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toContain('<stdout />')
  })

  it('renders command with stderr', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'command',
          commandName: 'test-cmd',
          input: 'test-cmd',
          stdout: '',
          stderr: 'Error message',
          exitCode: 1,
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toContain('<stderr>Error message</stderr>')
    expect(result).toContain('<failure code="1" />')
  })
})

describe('renderToXml - Wrapper Nodes', () => {
  it('renders command wrapper', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'wrapper',
          tag: 'command',
          children: [
            {
              type: 'command',
              commandName: 'echo',
              input: 'echo test',
              stdout: 'test',
              stderr: '',
              exitCode: 0,
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <command>
        <echo>
          <input>echo test</input>
          <stdout>test</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(result).toBe(expected)
  })
})

describe('renderToXml - Operators', () => {
  it('renders logical AND operator', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'wrapper',
          tag: 'command',
          children: [
            {
              type: 'command',
              commandName: 'echo',
              input: 'echo first',
              stdout: 'first',
              stderr: '',
              exitCode: 0,
            },
            { type: 'logical-and-operator' },
            {
              type: 'command',
              commandName: 'echo',
              input: 'echo second',
              stdout: 'second',
              stderr: '',
              exitCode: 0,
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toContain('<logical-and-operator />')
  })

  it('renders logical OR operator', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'wrapper',
          tag: 'command',
          children: [
            {
              type: 'command',
              commandName: 'false',
              input: 'false',
              stdout: '',
              stderr: '',
              exitCode: 1,
            },
            { type: 'logical-or-operator' },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toContain('<logical-or-operator />')
  })

  it('renders pipe operator', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'wrapper',
          tag: 'command',
          children: [
            {
              type: 'command',
              commandName: 'echo',
              input: 'echo hello',
              stdout: '',
              stderr: '',
              exitCode: 0,
              hiddenStdout: true,
            },
            { type: 'pipe-operator' },
            {
              type: 'command',
              commandName: 'grep',
              input: 'grep h',
              stdout: 'hello',
              stderr: '',
              exitCode: 0,
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toContain('<pipe-operator />')
    expect(result).not.toContain('<stdout />') // First command should not have stdout
  })
})

describe('renderToXml - Directory Nodes', () => {
  it('renders directory structure', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'directory',
          name: 'rules',
          children: [
            {
              type: 'content',
              lines: ['Line 1', 'Line 2'],
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <rules>
        Line 1
        Line 2
      </rules>
    `

    expect(result).toBe(expected)
  })

  it('renders nested directories', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'directory',
          name: 'docs',
          children: [
            {
              type: 'directory',
              name: 'api',
              children: [
                {
                  type: 'content',
                  lines: ['API content'],
                },
              ],
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <docs>
        <api>
          API content
        </api>
      </docs>
    `

    expect(result).toBe(expected)
  })
})

describe('renderToXml - Content Nodes', () => {
  it('renders content with proper indentation', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'directory',
          name: 'rules',
          children: [
            {
              type: 'content',
              lines: [
                '- Top level',
                '  - Nested item',
                '    - Deep nested',
                '- Another top',
              ],
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <rules>
        - Top level
          - Nested item
            - Deep nested
        - Another top
      </rules>
    `

    expect(result).toBe(expected)
  })
})

describe('renderToXml - fs-to-xml Special Rendering', () => {
  it('renders fs-to-xml command with extraChildren', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'command',
          commandName: 'fs-to-xml',
          input: 'fs-to-xml rules/test.md',
          stdout: '',
          stderr: '',
          exitCode: 0,
          fs2xmlNonShebang: true,
          extraChildren: [
            {
              type: 'directory',
              name: 'rules',
              children: [
                {
                  type: 'content',
                  lines: ['Rule content'],
                },
              ],
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <fs-to-xml>
        <input>fs-to-xml rules/test.md</input>
        <rules>
          Rule content
        </rules>
        <success code="0" />
      </fs-to-xml>
    `

    expect(result).toBe(expected)
  })
})

describe('renderToXml - Mixed Content', () => {
  it('renders commands and content in markdown', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'directory',
          name: 'rules',
          children: [
            {
              type: 'content',
              lines: ['Before command'],
            },
            {
              type: 'wrapper',
              tag: 'command',
              children: [
                {
                  type: 'command',
                  commandName: 'echo',
                  input: 'echo "in command"',
                  stdout: 'in command',
                  stderr: '',
                  exitCode: 0,
                },
              ],
            },
            {
              type: 'content',
              lines: ['After command'],
            },
          ],
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    const expected = dedent`
      <rules>
        Before command
        <command>
          <echo>
            <input>echo "in command"</input>
            <stdout>in command</stdout>
            <success code="0" />
          </echo>
        </command>
        After command
      </rules>
    `

    expect(result).toBe(expected)
  })
})

describe('renderToXml - Empty Tag', () => {
  it('renders empty tags', () => {
    const parsedInfo: ParsedFsInfo = {
      nodes: [
        {
          type: 'empty-tag',
          tag: 'placeholder',
        },
      ],
    }

    const result = renderToXml(parsedInfo, {})

    expect(result).toBe('<placeholder />')
  })
})
