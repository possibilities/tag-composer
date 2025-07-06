import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { renderToTags } from '../src/tag-renderer'

describe('renderToTags', () => {
  it('should render text nodes', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'hello world',
      },
      {
        type: 'text' as const,
        content: 'goodbye world',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <text>
          <content>hello world</content>
        </text>
        <text>
          <content>goodbye world</content>
        </text>
      </document>
    `)
  })

  it('should render command nodes with execution results', () => {
    const lines = [
      {
        type: 'command' as const,
        content: 'echo "test"',
        commandName: 'echo',
        statusCode: 0,
        stdout: 'test\n',
        stderr: '',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <command>
          <content>echo "test"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout>test</stdout>
          <stderr />
        </command>
      </document>
    `)
  })

  it('should render command with non-zero exit code', () => {
    const lines = [
      {
        type: 'command' as const,
        content: 'false',
        commandName: 'false',
        statusCode: 1,
        stdout: '',
        stderr: '',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <command>
          <content>false</content>
          <commandName>false</commandName>
          <statusCode>1</statusCode>
          <stdout />
          <stderr />
        </command>
      </document>
    `)
  })

  it('should render command with stderr output', () => {
    const lines = [
      {
        type: 'command' as const,
        content: 'command-with-error',
        commandName: 'command-with-error',
        statusCode: 1,
        stdout: 'some output\n',
        stderr: 'error message\n',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <command>
          <content>command-with-error</content>
          <commandName>command-with-error</commandName>
          <statusCode>1</statusCode>
          <stdout>some output</stdout>
          <stderr>error message</stderr>
        </command>
      </document>
    `)
  })

  it('should render mixed text and command nodes', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'Starting script',
      },
      {
        type: 'command' as const,
        content: 'echo "Hello"',
        commandName: 'echo',
        statusCode: 0,
        stdout: 'Hello\n',
        stderr: '',
      },
      {
        type: 'text' as const,
        content: 'Script complete',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <text>
          <content>Starting script</content>
        </text>
        <command>
          <content>echo "Hello"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout>Hello</stdout>
          <stderr />
        </command>
        <text>
          <content>Script complete</content>
        </text>
      </document>
    `)
  })

  it('should handle custom indentation', () => {
    const lines = [
      {
        type: 'text' as const,
        content: 'hello',
      },
      {
        type: 'command' as const,
        content: 'echo "test"',
        commandName: 'echo',
        statusCode: 0,
        stdout: 'test\n',
        stderr: '',
      },
    ]

    const result = renderToTags(lines, { indent: '    ' })

    expect(result).toBe(dedent`
      <document>
          <text>
              <content>hello</content>
          </text>
          <command>
              <content>echo "test"</content>
              <commandName>echo</commandName>
              <statusCode>0</statusCode>
              <stdout>test</stdout>
              <stderr />
          </command>
      </document>
    `)
  })

  it('should handle empty input', () => {
    const lines: any[] = []

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
      </document>
    `)
  })

  it('should handle commands with empty stdout and stderr', () => {
    const lines = [
      {
        type: 'command' as const,
        content: 'true',
        commandName: 'true',
        statusCode: 0,
        stdout: '',
        stderr: '',
      },
    ]

    const result = renderToTags(lines)

    expect(result).toBe(dedent`
      <document>
        <command>
          <content>true</content>
          <commandName>true</commandName>
          <statusCode>0</statusCode>
          <stdout />
          <stderr />
        </command>
      </document>
    `)
  })
})
