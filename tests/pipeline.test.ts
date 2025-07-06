import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/parse-content'
import { validateCommands } from '../src/validate-commands'
import { executeCommands } from '../src/execute-commands'
import { renderTags } from '../src/render-tags'

describe('Full Pipeline Integration', () => {
  it('should process a simple script through the entire pipeline', () => {
    const input = dedent`
      This is a simple script
      !!echo "Hello from the pipeline"
      !!echo "Testing 123"
      All done!
    `

    const parsed = parseContent(input)
    const validated = validateCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <text>
          <content>This is a simple script</content>
        </text>
        <command>
          <content>echo "Hello from the pipeline"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout>Hello from the pipeline</stdout>
          <stderr />
        </command>
        <command>
          <content>echo "Testing 123"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout>Testing 123</stdout>
          <stderr />
        </command>
        <text>
          <content>All done!</content>
        </text>
      </document>
    `)

    // Verify AST doesn't leak into output
    expect(tags).not.toContain('ast')
    expect(tags).not.toContain('Script')
    expect(tags).not.toContain('Word')
  })

  it('should handle error propagation at validation stage', () => {
    const input = dedent`
      Starting script
      !!echo "hello" | grep "world"
      This should not be reached
    `

    const parsed = parseContent(input)

    expect(() => validateCommands(parsed)).toThrow(
      'Only simple commands are allowed, found Pipeline',
    )
  })

  it('should handle commands with errors in the pipeline', () => {
    const input = dedent`
      Testing error handling
      !!false
      !!sh -c "echo 'Error message' >&2 && exit 42"
      Script continues after errors
    `

    const parsed = parseContent(input)
    const validated = validateCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <text>
          <content>Testing error handling</content>
        </text>
        <command>
          <content>false</content>
          <commandName>false</commandName>
          <statusCode>1</statusCode>
          <stdout />
          <stderr />
        </command>
        <command>
          <content>sh -c "echo 'Error message' >&2 && exit 42"</content>
          <commandName>sh</commandName>
          <statusCode>42</statusCode>
          <stdout />
          <stderr>Error message</stderr>
        </command>
        <text>
          <content>Script continues after errors</content>
        </text>
      </document>
    `)
  })

  it('should handle complex real-world scenario', () => {
    const input = dedent`
      System Information Report
      !!echo "Hostname: $(hostname)"
      !!pwd
      !!echo "Current user: $USER"
      !!false
      Report complete.
    `

    const pipeline = (input: string) => {
      const parsed = parseContent(input)
      const validated = validateCommands(parsed)
      const executed = executeCommands(validated)
      return renderTags(executed)
    }

    const tags = pipeline(input)

    // Check structure without asserting on dynamic values
    expect(tags).toMatch(/<document>/)
    expect(tags).toMatch(
      /<text>\s*<content>System Information Report<\/content>\s*<\/text>/,
    )
    expect(tags).toMatch(
      /<command>\s*<content>echo "Hostname: \$\(hostname\)"<\/content>/,
    )
    expect(tags).toMatch(/<commandName>echo<\/commandName>/)
    expect(tags).toMatch(/<statusCode>0<\/statusCode>/)
    expect(tags).toMatch(/<command>\s*<content>pwd<\/content>/)
    expect(tags).toMatch(/<command>\s*<content>false<\/content>/)
    expect(tags).toMatch(/<statusCode>1<\/statusCode>/)
    expect(tags).toMatch(
      /<text>\s*<content>Report complete\.<\/content>\s*<\/text>/,
    )
    expect(tags).toMatch(/<\/document>/)
  })

  it('should handle empty input', () => {
    const input = ''

    const parsed = parseContent(input)
    const validated = validateCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
      </document>
    `)
  })

  it('should handle input with only text', () => {
    const input = dedent`
      This is just text
      No commands here
      Only documentation
    `

    const parsed = parseContent(input)
    const validated = validateCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <text>
          <content>This is just text</content>
        </text>
        <text>
          <content>No commands here</content>
        </text>
        <text>
          <content>Only documentation</content>
        </text>
      </document>
    `)
  })

  it('should handle special characters in command output', () => {
    const input = dedent`
      !!echo "<tag>Special & chars</tag>"
      !!echo "Multiple words with spaces"
    `

    const parsed = parseContent(input)
    const validated = validateCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <command>
          <content>echo "<tag>Special & chars</tag>"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout><tag>Special & chars</tag></stdout>
          <stderr />
        </command>
        <command>
          <content>echo "Multiple words with spaces"</content>
          <commandName>echo</commandName>
          <statusCode>0</statusCode>
          <stdout>Multiple words with spaces</stdout>
          <stderr />
        </command>
      </document>
    `)
  })
})
