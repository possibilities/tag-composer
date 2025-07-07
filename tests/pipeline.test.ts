import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseContent } from '../src/parse-content'
import { parseCommands } from '../src/parse-commands'
import { executeCommands } from '../src/execute-commands'
import { renderTags } from '../src/render-tags'
import { runPipeline } from '../src/pipeline'

describe('Full Pipeline Integration', () => {
  it('should process a simple script through the entire pipeline', () => {
    const input = dedent`
      This is a simple script
      !!echo "Hello from the pipeline"
      !!echo "Testing 123"
      All done!
    `

    const parsed = parseContent(input)
    const validated = parseCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <text>
          <content>This is a simple script</content>
        </text>
        <command name='echo'>
          <input>echo "Hello from the pipeline"</input>
          <exit status='success' code='0' />
          <stdout>Hello from the pipeline</stdout>
          <stderr />
        </command>
        <command name='echo'>
          <input>echo "Testing 123"</input>
          <exit status='success' code='0' />
          <stdout>Testing 123</stdout>
          <stderr />
        </command>
        <text>
          <content>All done!</content>
        </text>
      </document>
    `)

    expect(tags).not.toContain('ast')
    expect(tags).not.toContain('Script')
    expect(tags).not.toContain('Word')
  })

  it('should handle error propagation at parsing stage', () => {
    const input = dedent`
      Starting script
      !!echo "hello" | grep "world"
      This should not be reached
    `

    const parsed = parseContent(input)

    expect(() => parseCommands(parsed)).toThrow(
      'Only simple commands are allowed',
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
    const validated = parseCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <text>
          <content>Testing error handling</content>
        </text>
        <command name='false'>
          <input>false</input>
          <exit status='failure' code='1' />
          <stdout />
          <stderr />
        </command>
        <command name='sh'>
          <input>sh -c "echo 'Error message' >&2 && exit 42"</input>
          <exit status='failure' code='42' />
          <stdout />
          <stderr>Error message</stderr>
        </command>
        <text>
          <content>Script continues after errors</content>
        </text>
      </document>
    `)
  })

  it('should handle complex real-world scenario', async () => {
    const input = dedent`
      System Information Report
      !!echo "Processing report..."
      !!pwd
      !!echo "Current directory shown above"
      !!false
      Report complete.
    `

    const pipeline = async (input: string) => {
      const parsed = parseContent(input)
      const validated = parseCommands(parsed)
      const executed = executeCommands(validated)
      return renderTags(executed)
    }

    const tags = await pipeline(input)

    expect(tags).toMatch(/<document>/)
    expect(tags).toMatch(
      /<text>\s*<content>System Information Report<\/content>\s*<\/text>/,
    )
    expect(tags).toMatch(
      /<command name='echo'>\s*<input>echo "Processing report..."<\/input>/,
    )

    expect(tags).toMatch(/<exit status='success' code='0' \/>/)
    expect(tags).toMatch(/<command name='pwd'>\s*<input>pwd<\/input>/)
    expect(tags).toMatch(/<command name='false'>\s*<input>false<\/input>/)
    expect(tags).toMatch(/<exit status='failure' code='1' \/>/)
    expect(tags).toMatch(
      /<text>\s*<content>Report complete\.<\/content>\s*<\/text>/,
    )
    expect(tags).toMatch(/<\/document>/)
  })

  it('should handle empty input', async () => {
    const input = ''

    const parsed = parseContent(input)
    const validated = parseCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
      </document>
    `)
  })

  it('should handle input with only text', async () => {
    const input = dedent`
      This is just text
      No commands here
      Only documentation
    `

    const parsed = parseContent(input)
    const validated = parseCommands(parsed)
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

  it('should handle special characters in command output', async () => {
    const input = dedent`
      !!echo "<tag>Special & chars</tag>"
      !!echo "Multiple words with spaces"
    `

    const parsed = parseContent(input)
    const validated = parseCommands(parsed)
    const executed = executeCommands(validated)
    const tags = renderTags(executed)

    expect(tags).toBe(dedent`
      <document>
        <command name='echo'>
          <input>echo "<tag>Special & chars</tag>"</input>
          <exit status='success' code='0' />
          <stdout><tag>Special & chars</tag></stdout>
          <stderr />
        </command>
        <command name='echo'>
          <input>echo "Multiple words with spaces"</input>
          <exit status='success' code='0' />
          <stdout>Multiple words with spaces</stdout>
          <stderr />
        </command>
      </document>
    `)
  })

  it('should work with runPipeline helper function', () => {
    const input = dedent`
      # Pipeline Test
      !!echo "Testing pipeline"
      Done!
    `

    const output = runPipeline(input)

    expect(output).toBe(dedent`
      <document>
        <text>
          <content># Pipeline Test</content>
        </text>
        <command name='echo'>
          <input>echo "Testing pipeline"</input>
          <exit status='success' code='0' />
          <stdout>Testing pipeline</stdout>
          <stderr />
        </command>
        <text>
          <content>Done!</content>
        </text>
      </document>
    `)
  })

  it('should handle calling command with invalid file', () => {
    const input = dedent`
      !!tag-composer invalid-file.md
    `

    expect(() => runPipeline(input, 'tag-composer')).toThrow(
      /File 'invalid-file.md' not found/,
    )
  })

  it('should replace calling command with pipeline-processed content', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
    const includedFile = join(tempDir, 'included.md')

    writeFileSync(
      includedFile,
      dedent`
      # Included Content
      !!echo "From included file"
      More text
    `,
    )

    const input = dedent`
      # Main Document
      !!tag-composer ${includedFile}
      Footer text
    `

    try {
      const output = runPipeline(input, 'tag-composer')

      expect(output).toBe(dedent`
        <document>
          <text>
            <content># Main Document</content>
          </text>
          <text>
            <content># Included Content</content>
          </text>
          <command name='echo'>
            <input>echo "From included file"</input>
            <exit status='success' code='0' />
            <stdout>From included file</stdout>
            <stderr />
          </command>
          <text>
            <content>More text</content>
          </text>
          <text>
            <content>Footer text</content>
          </text>
        </document>
      `)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should prevent infinite recursion with --json flag', () => {
    const input = dedent`
      !!tag-composer --json test.md
    `

    expect(() => runPipeline(input, 'tag-composer')).toThrow(
      /Cannot execute 'tag-composer' with --json flag/,
    )
  })

  it('should handle nested includes', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
    const nestedFile = join(tempDir, 'nested.md')
    const middleFile = join(tempDir, 'middle.md')

    writeFileSync(
      nestedFile,
      dedent`
      Deeply nested content
      !!echo "From nested"
    `,
    )

    writeFileSync(
      middleFile,
      dedent`
      Middle layer
      !!tag-composer ${nestedFile}
      Back to middle
    `,
    )

    const input = dedent`
      Top level
      !!tag-composer ${middleFile}
      End of top
    `

    try {
      const output = runPipeline(input, 'tag-composer')

      expect(output).toBe(dedent`
        <document>
          <text>
            <content>Top level</content>
          </text>
          <text>
            <content>Middle layer</content>
          </text>
          <text>
            <content>Deeply nested content</content>
          </text>
          <command name='echo'>
            <input>echo "From nested"</input>
            <exit status='success' code='0' />
            <stdout>From nested</stdout>
            <stderr />
          </command>
          <text>
            <content>Back to middle</content>
          </text>
          <text>
            <content>End of top</content>
          </text>
        </document>
      `)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
