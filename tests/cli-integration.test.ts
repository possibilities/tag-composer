import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync, spawn } from 'child_process'
import dedent from 'dedent'

describe('CLI Integration', () => {
  let tempDir: string
  let testFile: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
    testFile = join(tempDir, 'test.md')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should process a markdown file through the pipeline', () => {
    const content = dedent`
      # Test Document
      !!echo "Hello from CLI"
      !!pwd
      All done!
    `
    writeFileSync(testFile, content)

    const output = execSync(`node dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toContain('<document>')
    expect(output).toContain('<text>')
    expect(output).toContain('<content># Test Document</content>')
    expect(output).toContain("<command name='echo'>")
    expect(output).toContain('<input>echo "Hello from CLI"</input>')
    expect(output).toContain('<stdout>Hello from CLI</stdout>')
    expect(output).toContain("<command name='pwd'>")
    expect(output).toContain('<content>All done!</content>')
    expect(output).toContain('</document>')
  })

  it('should handle empty markdown files', () => {
    writeFileSync(testFile, '')

    const output = execSync(`node dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output.trim()).toBe(dedent`
      <document>
      </document>
    `)
  })

  it('should handle markdown files with only text', () => {
    const content = dedent`
      # Just Text
      No commands here
      Only documentation
    `
    writeFileSync(testFile, content)

    const output = execSync(`node dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toBe(dedent`
      <document>
        <text>
          <content># Just Text</content>
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

  it('should handle tag-composer commands with invalid files', () => {
    const content = dedent`
      !!tag-composer nonexistent.md
    `
    writeFileSync(testFile, content)

    expect(() => {
      execSync(`node dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })
    }).toThrow()
  })

  it('should replace tag-composer commands with included file content', () => {
    const validFile = join(tempDir, 'valid.md')
    writeFileSync(validFile, '# Valid file')

    const content = dedent`
      !!tag-composer "${validFile}"
    `
    writeFileSync(testFile, content)

    const output = execSync(`node dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    // The tag-composer command should be replaced with the content of valid.md
    expect(output).toBe(dedent`
      <document>
        <text>
          <content># Valid file</content>
        </text>
      </document>
    
    `)
  })

  it('should handle file not found errors', () => {
    expect(() => {
      execSync('node dist/cli.js nonexistent.md', {
        encoding: 'utf-8',
      })
    }).toThrow(/File 'nonexistent.md' not found/)
  })

  it('should handle non-markdown file errors', () => {
    const txtFile = join(tempDir, 'test.txt')
    writeFileSync(txtFile, 'test content')

    expect(() => {
      execSync(`node dist/cli.js "${txtFile}"`, {
        encoding: 'utf-8',
      })
    }).toThrow(/not a markdown file/)
  })

  it('should detect circular dependencies', () => {
    const file1 = join(tempDir, 'circular1.md')
    const file2 = join(tempDir, 'circular2.md')

    writeFileSync(
      file1,
      dedent`
      # Circular 1
      !!tag-composer circular2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # Circular 2
      !!tag-composer circular1.md
    `,
    )

    expect(() => {
      execSync(`node dist/cli.js "${file1}"`, {
        encoding: 'utf-8',
      })
    }).toThrow(/Circular dependency detected/)
  })

  it('should skip circular dependency check with --no-recursion-check', () => {
    const file1 = join(tempDir, 'circular1.md')
    const file2 = join(tempDir, 'circular2.md')

    writeFileSync(
      file1,
      dedent`
      # Circular 1
      !!tag-composer circular2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # Circular 2
      !!tag-composer circular1.md
    `,
    )

    const child = spawn('node', ['dist/cli.js', '--no-recursion-check', file1])

    setTimeout(() => {
      child.kill()
    }, 100)

    expect(() => child).not.toThrow()
  })
})
