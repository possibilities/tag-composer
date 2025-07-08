import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync, spawn } from 'child_process'
import dedent from 'dedent'

describe('CLI Integration', () => {
  let tempDir: string
  let testFile: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    const timestamp = Date.now()
    tempDir = join(tmpdir(), `tag-composer-test-${timestamp}`)
    mkdirSync(tempDir, { recursive: true })
    process.chdir(tempDir)
    testFile = join(tempDir, 'test.md')
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should process a markdown file through the pipeline', () => {
    const content = dedent`
      # Test Document
      This is plain text
      All done!
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toBe(dedent`
      <document>
        <text>
          # Test Document
        </text>
        <text>
          This is plain text
        </text>
        <text>
          All done!
        </text>
      </document>
    
    `)
  })

  it('should handle empty markdown files', () => {
    writeFileSync(testFile, '')

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output.trim()).toBe(dedent`
      <document/>
    `)
  })

  it('should handle markdown files with only text', () => {
    const content = dedent`
      # Just Text
      No references here
      Only documentation
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toBe(dedent`
      <document>
        <text>
          # Just Text
        </text>
        <text>
          No references here
        </text>
        <text>
          Only documentation
        </text>
      </document>
    
    `)
  })

  it('should handle markdown references with invalid files', () => {
    const content = dedent`
      @@nonexistent.md
    `
    writeFileSync(testFile, content)

    expect(() => {
      execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })
    }).toThrow()
  })

  it('should replace markdown references with included file content', () => {
    const validFile = join(tempDir, 'valid.md')
    writeFileSync(validFile, '# Valid file')

    const content = dedent`
      @@valid.md
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toBe(dedent`
      <document>
        <text>
          # Valid file
        </text>
      </document>
    
    `)
  })

  it('should handle file not found errors', () => {
    expect(() => {
      execSync(`node ${originalCwd}/dist/cli.js nonexistent.md`, {
        encoding: 'utf-8',
      })
    }).toThrow(/File 'nonexistent.md' not found/)
  })

  it('should handle non-markdown file errors', () => {
    const txtFile = join(tempDir, 'test.txt')
    writeFileSync(txtFile, 'test content')

    expect(() => {
      execSync(`node ${originalCwd}/dist/cli.js "${txtFile}"`, {
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
      @@circular2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # Circular 2
      @@circular1.md
    `,
    )

    expect(() => {
      execSync(`node ${originalCwd}/dist/cli.js "${file1}"`, {
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
      @@circular2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # Circular 2
      @@circular1.md
    `,
    )

    const child = spawn('node', [
      `${originalCwd}/dist/cli.js`,
      '--no-recursion-check',
      file1,
    ])

    setTimeout(() => {
      child.kill()
    }, 100)

    expect(() => child).not.toThrow()
  })

  describe('nested tag generation', () => {
    it('should wrap content in nested tags based on directory path', () => {
      const nestedDir = join(tempDir, 'foo', 'bar')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'baz.md')
      writeFileSync(nestedFile, '# Nested content')

      const content = dedent`
        @@foo/bar/baz.md
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <foo>
            <bar>
              <text>
                # Nested content
              </text>
            </bar>
          </foo>
        </document>
      
      `)
    })

    it('should handle single directory paths', () => {
      const subDir = join(tempDir, 'sub')
      mkdirSync(subDir, { recursive: true })
      const subFile = join(subDir, 'file.md')
      writeFileSync(subFile, '# Single dir')

      const content = dedent`
        @@sub/file.md
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <sub>
            <text>
              # Single dir
            </text>
          </sub>
        </document>
      
      `)
    })

    it('should handle files in the same directory', () => {
      const sameFile = join(tempDir, 'same.md')
      writeFileSync(sameFile, '# Same dir')

      const content = dedent`
        @@same.md
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <text>
            # Same dir
          </text>
        </document>
      
      `)
    })

    it('should handle absolute paths', () => {
      const absDir = join(tempDir, 'absolute')
      mkdirSync(absDir, { recursive: true })
      const absFile = join(absDir, 'file.md')
      writeFileSync(absFile, '# Absolute path')

      const content = dedent`
        @@${absFile}
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <text>
            # Absolute path
          </text>
        </document>
      
      `)
    })

    it('should handle parent directory references', () => {
      const parentFile = join(tempDir, 'parent.md')
      writeFileSync(parentFile, '# Parent file')

      const subDir = join(tempDir, 'sub')
      mkdirSync(subDir, { recursive: true })
      const subFile = join(subDir, 'child.md')

      const content = dedent`
        @@../parent.md
      `
      writeFileSync(subFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-resolve-markdown-relative-to-cwd "${subFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <text>
            # Parent file
          </text>
        </document>
      
      `)
    })
  })

  describe('--resolve-markdown-relative-to-cwd option', () => {
    it('should resolve relative to CWD by default', () => {
      const subDir = join(tempDir, 'sub')
      mkdirSync(subDir, { recursive: true })

      const relativeFile = join(tempDir, 'relative.md')
      writeFileSync(relativeFile, '# Relative file')

      const content = dedent`
        @@relative.md
      `
      const subFile = join(subDir, 'test.md')
      writeFileSync(subFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${subFile}"`, {
        encoding: 'utf-8',
        cwd: tempDir,
      })

      expect(output).toBe(dedent`
        <document>
          <text>
            # Relative file
          </text>
        </document>
      
      `)
    })

    it('should resolve relative to markdown file with --no-resolve-markdown-relative-to-cwd', () => {
      const subDir = join(tempDir, 'sub')
      mkdirSync(subDir, { recursive: true })

      const relativeFile = join(subDir, 'relative.md')
      writeFileSync(relativeFile, '# Relative in subdir')

      const content = dedent`
        @@relative.md
      `
      const subFile = join(subDir, 'test.md')
      writeFileSync(subFile, content)

      // Change working directory to test proper resolution
      process.chdir(tempDir)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-resolve-markdown-relative-to-cwd "${subFile}"`,
        {
          encoding: 'utf-8',
          cwd: tempDir,
        },
      )

      expect(output).toBe(dedent`
        <document>
          <text>
            # Relative in subdir
          </text>
        </document>
      
      `)
    })
  })

  describe('--json option', () => {
    it('should output JSON with --json flag', () => {
      const content = dedent`
        # Test
        Some text
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --json "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      const json = JSON.parse(output)
      expect(json).toEqual([
        {
          type: 'element',
          name: 'text',
          elements: [{ type: 'text', text: '# Test' }],
        },
        {
          type: 'element',
          name: 'text',
          elements: [{ type: 'text', text: 'Some text' }],
        },
      ])
    })

    it('should output JSON for nested includes', () => {
      const includedFile = join(tempDir, 'included.md')
      writeFileSync(includedFile, '# Included')

      const content = dedent`
        Main
        @@included.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --json "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      const json = JSON.parse(output)
      expect(json).toEqual([
        {
          type: 'element',
          name: 'text',
          elements: [{ type: 'text', text: 'Main' }],
        },
        {
          type: 'element',
          name: 'text',
          elements: [{ type: 'text', text: '# Included' }],
        },
      ])
    })
  })
})
