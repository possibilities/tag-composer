import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir, homedir } from 'os'
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
        # Test Document
        This is plain text
        All done!
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
        # Just Text
        No references here
        Only documentation
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
        # Valid file
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
              # Nested content
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
            # Single dir
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
          # Same dir
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
          # Absolute path
        </document>
      
      `)
    })

    it('should handle current directory references', () => {
      const currentFile = join(tempDir, 'current.md')
      writeFileSync(currentFile, '# Current dir file')

      const content = dedent`
        @@./current.md
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          # Current dir file
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

      const output = execSync(`node ${originalCwd}/dist/cli.js "${subFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          # Parent file
        </document>
      
      `)
    })

    it('should handle parent directory references with nested paths', () => {
      const queryDir = join(tempDir, 'query')
      mkdirSync(queryDir, { recursive: true })
      const promptFile = join(queryDir, 'prompt.md')
      writeFileSync(promptFile, '# Query prompt')

      const deepDir = join(tempDir, 'deep', 'nested')
      mkdirSync(deepDir, { recursive: true })
      const deepFile = join(deepDir, 'file.md')

      const content = dedent`
        @@../../query/prompt.md
      `
      writeFileSync(deepFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${deepFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <query>
            # Query prompt
          </query>
        </document>
      
      `)
    })
  })

  it('should expand ~/ to home directory', () => {
    const homeFile = join(homedir(), 'test-tag-composer.md')
    writeFileSync(homeFile, '# Home file')

    try {
      const output = execSync(
        `node ${originalCwd}/dist/cli.js "~/test-tag-composer.md"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          # Home file
        </document>
      
      `)
    } finally {
      // Clean up
      rmSync(homeFile, { force: true })
    }
  })

  describe('--indent-spaces option', () => {
    it('should use custom indentation with --indent-spaces 4', () => {
      const content = dedent`
        # Test
        Some text
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --indent-spaces 4 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
            # Test
            Some text
        </document>
      
      `)
    })

    it('should use no indentation with --indent-spaces 0', () => {
      const content = dedent`
        # Test
        Some text
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --indent-spaces 0 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
        # Test
        Some text
        </document>
      `)
    })

    it('should work with nested tags and custom indentation', () => {
      const nestedDir = join(tempDir, 'foo', 'bar')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'baz.md')
      writeFileSync(nestedFile, '# Nested content')

      const content = dedent`
        @@foo/bar/baz.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --indent-spaces 3 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
           <foo>
              <bar>
                 # Nested content
              </bar>
           </foo>
        </document>
      
      `)
    })

    it('should work with nested tags and 0 indentation', () => {
      const nestedDir = join(tempDir, 'foo')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'test.md')
      writeFileSync(
        nestedFile,
        dedent`
        # Nested
        Content here
      `,
      )

      const content = dedent`
        @@foo/test.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --indent-spaces 0 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
        <foo>
        # Nested
        Content here
        </foo>
        </document>
      `)
    })

    it('should preserve text indentation with 0 indent spaces', () => {
      const nestedDir = join(tempDir, 'nested')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'list.md')
      writeFileSync(
        nestedFile,
        dedent`
        - a
          - b
            - c
        - d
      `,
      )

      const content = dedent`
        @@nested/list.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --indent-spaces 0 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
        <nested>
        - a
          - b
            - c
        - d
        </nested>
        </document>
      `)
    })

    it('should reject negative indent spaces', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --indent-spaces -1 "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/--indent-spaces must be a non-negative number/)
    })

    it('should reject non-numeric indent spaces', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --indent-spaces abc "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/--indent-spaces must be a non-negative number/)
    })
  })

  describe('Root tag options', () => {
    it('should use custom root tag', () => {
      const content = dedent`
        # Test Document
        This is plain text
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --root-tag-name prompt "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <prompt>
          # Test Document
          This is plain text
        </prompt>
      
      `)
    })

    it('should use custom root tag with hyphens', () => {
      const content = dedent`
        # Test Document
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --root-tag-name foo-bar "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <foo-bar>
          # Test Document
        </foo-bar>
      
      `)
    })

    it('should output fragments with --no-root-tag', () => {
      const content = dedent`
        # Heading
        Some text
        More content
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-root-tag "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        # Heading
        Some text
        More content
      `)
    })

    it('should output fragments with proper spacing for multiple elements', () => {
      const content = dedent`
        First line
        Second line
        Third line
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-root-tag "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        First line
        Second line
        Third line
      `)
    })

    it('should reject tag names starting with numbers', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --root-tag-name 123tag "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid tag name '123tag'/)
    })

    it('should reject tag names starting with xml', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --root-tag-name xml-custom "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid tag name 'xml-custom'/)
    })

    it('should reject tag names starting with XML uppercase', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --root-tag-name XMLDocument "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid tag name 'XMLDocument'/)
    })

    it('should reject tag names with underscores', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --root-tag-name my_tag "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid tag name 'my_tag'/)
    })

    it('should reject tag names starting with hyphen', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --root-tag-name -invalid "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid tag name '-invalid'/)
    })

    it('should ignore --root-tag-name when --no-root-tag is used', () => {
      const content = dedent`
        # Test Document
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --root-tag-name custom --no-root-tag "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        # Test Document
      `)
    })

    it('should work with --indent-spaces 0 and custom root tag', () => {
      const content = dedent`
        # Heading
        Content here
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --root-tag-name prompt --indent-spaces 0 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <prompt>
        # Heading
        Content here
        </prompt>
      
      `)
    })

    it('should work with --indent-spaces 0 and --no-root-tag', () => {
      const content = dedent`
        # Heading
        Content here
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-root-tag --indent-spaces 0 "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        # Heading
        Content here
      `)
    })
  })

  describe('--convert-path-to-tag-strategy option', () => {
    beforeEach(() => {
      const nestedDir = join(tempDir, 'docs', 'api', 'v1')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = join(nestedDir, 'endpoints.md')
      writeFileSync(nestedFile, '# API Endpoints')
    })

    it('should use all strategy by default', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(`node ${originalCwd}/dist/cli.js "${testFile}"`, {
        encoding: 'utf-8',
      })

      expect(output).toBe(dedent`
        <document>
          <docs>
            <api>
              <v1>
                # API Endpoints
              </v1>
            </api>
          </docs>
        </document>
      
      `)
    })

    it('should use head strategy', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --convert-path-to-tag-strategy head "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <docs>
            # API Endpoints
          </docs>
        </document>
      
      `)
    })

    it('should use tail strategy', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --convert-path-to-tag-strategy tail "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <api>
            <v1>
              # API Endpoints
            </v1>
          </api>
        </document>
      
      `)
    })

    it('should use init strategy', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --convert-path-to-tag-strategy init "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <docs>
            <api>
              # API Endpoints
            </api>
          </docs>
        </document>
      
      `)
    })

    it('should use last strategy', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --convert-path-to-tag-strategy last "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <v1>
            # API Endpoints
          </v1>
        </document>
      
      `)
    })

    it('should reject invalid strategy', () => {
      writeFileSync(testFile, '# Test')

      expect(() => {
        execSync(
          `node ${originalCwd}/dist/cli.js --convert-path-to-tag-strategy invalid "${testFile}"`,
          {
            encoding: 'utf-8',
          },
        )
      }).toThrow(/Invalid --convert-path-to-tag-strategy value 'invalid'/)
    })

    it('should work with --no-root-tag and path strategy', () => {
      const content = dedent`
        @@docs/api/v1/endpoints.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --no-root-tag --convert-path-to-tag-strategy head "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <docs>
          # API Endpoints
        </docs>
      `)
    })
  })

  describe('--lift-all-tags-to-root option', () => {
    it('should lift nested tags to root level', () => {
      const rolesDir = join(tempDir, 'roles')
      mkdirSync(rolesDir, { recursive: true })

      const rulesDir = join(rolesDir, 'rules')
      mkdirSync(rulesDir, { recursive: true })

      writeFileSync(join(rolesDir, 'engineer.md'), 'You are an engineer')
      writeFileSync(join(rulesDir, 'rule1.md'), 'Rule 1')
      writeFileSync(join(rulesDir, 'rule2.md'), 'Rule 2')

      const content = dedent`
        @@roles/engineer.md
        @@roles/rules/rule1.md
        @@roles/rules/rule2.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --lift-all-tags-to-root "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <roles>
            You are an engineer
          </roles>
          <rules>
            Rule 1
          </rules>
          <rules>
            Rule 2
          </rules>
        </document>
      
      `)
    })

    it('should work with deeply nested structures', () => {
      const level1Dir = join(tempDir, 'level1')
      const level2Dir = join(level1Dir, 'level2')
      const level3Dir = join(level2Dir, 'level3')

      mkdirSync(level3Dir, { recursive: true })

      writeFileSync(join(level1Dir, 'text.md'), 'Level 1 text')
      writeFileSync(join(level2Dir, 'text.md'), 'Level 2 text')
      writeFileSync(join(level3Dir, 'text.md'), 'Level 3 text')

      const content = dedent`
        @@level1/text.md
        @@level1/level2/text.md
        @@level1/level2/level3/text.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --lift-all-tags-to-root "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <level1>
            Level 1 text
          </level1>
          <level2>
            Level 2 text
          </level2>
          <level3>
            Level 3 text
          </level3>
        </document>
      
      `)
    })
  })

  describe('--inline-common-tags option', () => {
    it('should merge multiple tags with the same name', () => {
      const rulesDir = join(tempDir, 'rules')
      mkdirSync(rulesDir, { recursive: true })

      writeFileSync(join(rulesDir, 'rule1.md'), 'Rule 1')
      writeFileSync(join(rulesDir, 'rule2.md'), 'Rule 2')
      writeFileSync(join(rulesDir, 'rule3.md'), 'Rule 3')

      const content = dedent`
        @@rules/rule1.md
        @@rules/rule2.md
        @@rules/rule3.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --inline-common-tags "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <rules>
            Rule 1
            Rule 2
            Rule 3
          </rules>
        </document>
      
      `)
    })

    it('should handle nested common tags', () => {
      const rolesDir = join(tempDir, 'roles')
      mkdirSync(rolesDir, { recursive: true })

      const rulesDir = join(rolesDir, 'rules')
      mkdirSync(rulesDir, { recursive: true })

      writeFileSync(join(rolesDir, 'engineer.md'), 'You are an engineer')
      writeFileSync(join(rulesDir, 'rule1.md'), 'Rule 1')
      writeFileSync(join(rulesDir, 'rule2.md'), 'Rule 2')

      const content = dedent`
        @@roles/engineer.md
        @@roles/rules/rule1.md
        @@roles/rules/rule2.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --inline-common-tags "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <roles>
            You are an engineer
            <rules>
              Rule 1
              Rule 2
            </rules>
          </roles>
        </document>
      
      `)
    })
  })

  describe('Combined transformation options', () => {
    it('should apply both transformations when both options are used', () => {
      const rolesDir = join(tempDir, 'roles')
      mkdirSync(rolesDir, { recursive: true })

      const rulesDir = join(rolesDir, 'rules')
      mkdirSync(rulesDir, { recursive: true })

      writeFileSync(join(rolesDir, 'engineer.md'), 'You are an engineer')
      writeFileSync(join(rulesDir, 'rule1.md'), 'Rule 1')
      writeFileSync(join(rulesDir, 'rule2.md'), 'Rule 2')

      const content = dedent`
        @@roles/engineer.md
        @@roles/rules/rule1.md
        @@roles/rules/rule2.md
      `
      writeFileSync(testFile, content)

      const output = execSync(
        `node ${originalCwd}/dist/cli.js --lift-all-tags-to-root --inline-common-tags "${testFile}"`,
        {
          encoding: 'utf-8',
        },
      )

      expect(output).toBe(dedent`
        <document>
          <roles>
            You are an engineer
          </roles>
          <rules>
            Rule 1
            Rule 2
          </rules>
        </document>
      
      `)
    })
  })
})
