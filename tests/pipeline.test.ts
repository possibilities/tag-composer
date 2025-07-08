import dedent from 'dedent'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseContent } from '../src/parse-content'
import { processMarkdownReferences } from '../src/process-markdown-references'
import { renderTags } from '../src/render-tags'
import { runPipeline } from '../src/pipeline'

describe('Full Pipeline Integration', () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should process a simple script with text only', () => {
    const input = dedent`
      This is a simple script
      Just plain text
      All done!
    `

    const parsed = parseContent(input)
    const processed = processMarkdownReferences(parsed)
    const tags = renderTags(processed)

    expect(tags).toBe(dedent`
      <document>
        This is a simple script
        Just plain text
        All done!
      </document>
    `)
  })

  it('should process markdown references', () => {
    writeFileSync(
      join(tempDir, 'included.md'),
      dedent`
        This is included content
        From another file
      `,
    )

    const input = dedent`
      Main content
      @@included.md
      Back to main
    `

    const output = runPipeline(input, join(tempDir, 'main.md'))

    expect(output).toBe(dedent`
      <document>
        Main content
        This is included content
        From another file
        Back to main
      </document>
    `)
  })

  it('should handle nested markdown references', () => {
    writeFileSync(
      join(tempDir, 'level2.md'),
      dedent`
        Level 2 content
      `,
    )

    writeFileSync(
      join(tempDir, 'level1.md'),
      dedent`
        Level 1 content
        @@level2.md
        Back to level 1
      `,
    )

    const input = dedent`
      Root content
      @@level1.md
      Back to root
    `

    const output = runPipeline(input, join(tempDir, 'root.md'))

    expect(output).toBe(dedent`
      <document>
        Root content
        Level 1 content
        Level 2 content
        Back to level 1
        Back to root
      </document>
    `)
  })

  it('should wrap content in directory-based tags', () => {
    mkdirSync(join(tempDir, 'docs'))
    mkdirSync(join(tempDir, 'docs/api'))

    writeFileSync(
      join(tempDir, 'docs/api/endpoints.md'),
      dedent`
        API Endpoints
        GET /users
        POST /users
      `,
    )

    const input = dedent`
      Documentation
      @@docs/api/endpoints.md
      End of docs
    `

    const output = runPipeline(input, join(tempDir, 'main.md'))

    expect(output).toBe(dedent`
      <document>
        Documentation
        <docs>
          <api>
            API Endpoints
            GET /users
            POST /users
          </api>
        </docs>
        End of docs
      </document>
    `)
  })

  it('should handle error when markdown file does not exist', () => {
    const input = dedent`
      Testing error handling
      @@nonexistent.md
      This should not be reached
    `

    expect(() => runPipeline(input, join(tempDir, 'main.md'))).toThrow()
  })

  it('should handle empty markdown files', () => {
    writeFileSync(join(tempDir, 'empty.md'), '')

    const input = dedent`
      Before empty
      @@empty.md
      After empty
    `

    const output = runPipeline(input, join(tempDir, 'main.md'))

    expect(output).toBe(dedent`
      <document>
        Before empty
        After empty
      </document>
    `)
  })

  it('should process multiple markdown references', () => {
    writeFileSync(
      join(tempDir, 'first.md'),
      dedent`
        First file content
      `,
    )

    writeFileSync(
      join(tempDir, 'second.md'),
      dedent`
        Second file content
      `,
    )

    const input = dedent`
      Start
      @@first.md
      Middle
      @@second.md
      End
    `

    const output = runPipeline(input, join(tempDir, 'main.md'))

    expect(output).toBe(dedent`
      <document>
        Start
        First file content
        Middle
        Second file content
        End
      </document>
    `)
  })
})
