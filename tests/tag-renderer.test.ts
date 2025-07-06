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
        <text>hello world</text>
        <text>goodbye world</text>
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
        <command name="echo" exitCode="0">
          <content>echo "test"</content>
          <stdout>test</stdout>
          <stderr></stderr>
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
        <command name="false" exitCode="1">
          <content>false</content>
          <stdout></stdout>
          <stderr></stderr>
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
        <command name="command-with-error" exitCode="1">
          <content>command-with-error</content>
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
        <text>Starting script</text>
        <command name="echo" exitCode="0">
          <content>echo "Hello"</content>
          <stdout>Hello</stdout>
          <stderr></stderr>
        </command>
        <text>Script complete</text>
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
          <text>hello</text>
          <command name="echo" exitCode="0">
              <content>echo "test"</content>
              <stdout>test</stdout>
              <stderr></stderr>
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
        <command name="true" exitCode="0">
          <content>true</content>
          <stdout></stdout>
          <stderr></stderr>
        </command>
      </document>
    `)
  })
})
