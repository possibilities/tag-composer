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
      !!echo "Hello from CLI"
      !!pwd
      All done!
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    // Extract the pwd output to handle dynamic content
    const lines = output.split('\n')
    let pwdOutput = ''
    let foundPwdCommand = false

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<command name="pwd">')) {
        foundPwdCommand = true
      }
      if (foundPwdCommand && lines[i].includes('<stdout>')) {
        // Next line should contain the pwd output
        pwdOutput = lines[i + 1].trim()
        break
      }
    }

    expect(output).toBe(dedent`
      <document>
        <text>
          <content>
            # Test Document
          </content>
        </text>
        <command name="echo">
          <input>
            echo "Hello from CLI"
          </input>
          <exit status="success" code="0"/>
          <stdout>
            Hello from CLI
          </stdout>
          <stderr/>
        </command>
        <command name="pwd">
          <input>
            pwd
          </input>
          <exit status="success" code="0"/>
          <stdout>
            ${pwdOutput}
          </stdout>
          <stderr/>
        </command>
        <text>
          <content>
            All done!
          </content>
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
      No commands here
      Only documentation
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    expect(output).toBe(dedent`
      <document>
        <text>
          <content>
            # Just Text
          </content>
        </text>
        <text>
          <content>
            No commands here
          </content>
        </text>
        <text>
          <content>
            Only documentation
          </content>
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
      execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })
    }).toThrow()
  })

  it('should replace tag-composer commands with included file content', () => {
    const validFile = join(tempDir, 'valid.md')
    writeFileSync(validFile, '# Valid file')

    const content = dedent`
      !!tag-composer "valid.md"
    `
    writeFileSync(testFile, content)

    const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
      encoding: 'utf-8',
    })

    // The tag-composer command should be replaced with the content of valid.md
    expect(output).toBe(dedent`
      <document>
        <text>
          <content>
            # Valid file
          </content>
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
        !!tag-composer "foo/bar/baz.md"
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
                <content>
                  # Nested content
                </content>
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
        !!tag-composer "sub/file.md"
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <sub>
            <text>
              <content>
                # Single dir
              </content>
            </text>
          </sub>
        </document>
      
      `)
    })

    it('should not wrap content for files in root directory', () => {
      const rootFile = join(tempDir, 'root.md')
      writeFileSync(rootFile, '# Root file')

      const content = dedent`
        !!tag-composer "root.md"
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <text>
            <content>
              # Root file
            </content>
          </text>
        </document>
      
      `)
    })

    it('should handle relative paths with dots correctly', () => {
      const nestedDir = join(tempDir, 'foo', 'bar')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'baz.md')
      writeFileSync(nestedFile, '# Relative content')

      const content = dedent`
        !!tag-composer "foo/bar/baz.md"
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
                <content>
                  # Relative content
                </content>
              </text>
            </bar>
          </foo>
        </document>
      
      `)
    })

    it('should handle paths with parent directory references', () => {
      const nestedDir = join(tempDir, 'foo', 'bar')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'baz.md')
      writeFileSync(nestedFile, '# Parent ref content')

      const deepDir = join(tempDir, 'deep', 'nested')
      mkdirSync(deepDir, { recursive: true })
      const deepFile = join(deepDir, 'test.md')

      const content = dedent`
        !!tag-composer "../../foo/bar/baz.md"
      `
      writeFileSync(deepFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${deepFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <foo>
            <bar>
              <text>
                <content>
                  # Parent ref content
                </content>
              </text>
            </bar>
          </foo>
        </document>
      
      `)
    })

    it('should handle deeply nested directories', () => {
      const deepPath = join(tempDir, 'a', 'b', 'c', 'd', 'e')
      mkdirSync(deepPath, { recursive: true })
      const deepFile = join(deepPath, 'deep.md')
      writeFileSync(deepFile, '# Deep content')

      const content = dedent`
        !!tag-composer "a/b/c/d/e/deep.md"
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <a>
            <b>
              <c>
                <d>
                  <e>
                    <text>
                      <content>
                        # Deep content
                      </content>
                    </text>
                  </e>
                </d>
              </c>
            </b>
          </a>
        </document>
      
      `)
    })
  })
})
