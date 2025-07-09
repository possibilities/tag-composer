import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { composeTags } from '../src/lib.js'
import dedent from 'dedent'

describe('Library API', () => {
  let testDir: string
  let testFile: string

  beforeEach(() => {
    testDir = mkdirSync(join(tmpdir(), `tag-composer-lib-test-${Date.now()}`), {
      recursive: true,
    })
    testFile = join(testDir, 'test.md')
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('should process a simple markdown file', () => {
    writeFileSync(testFile, '# Test\nHello world')

    const result = composeTags(testFile)

    expect(result).toBe(dedent`
      <document>
        # Test
        Hello world
      </document>
    `)
  })

  it('should accept options', () => {
    writeFileSync(testFile, '# Test')

    const result = composeTags(testFile, {
      indentSpaces: 4,
      rootTagName: 'custom-root',
    })

    expect(result).toBe(dedent`
      <custom-root>
          # Test
      </custom-root>
    `)
  })

  it('should handle string indent spaces', () => {
    writeFileSync(testFile, '# Test')

    const result = composeTags(testFile, {
      indentSpaces: '0',
    })

    expect(result).toBe(dedent`
      <document>
      # Test
      </document>
    `)
  })

  it('should throw on invalid file', () => {
    expect(() => {
      composeTags('/nonexistent/file.md')
    }).toThrow("Error: File '/nonexistent/file.md' not found")
  })

  it('should throw on non-markdown file', () => {
    const txtFile = join(testDir, 'test.txt')
    writeFileSync(txtFile, 'test')

    expect(() => {
      composeTags(txtFile)
    }).toThrow(/is not a markdown file/)
  })

  it('should throw on invalid indent spaces', () => {
    writeFileSync(testFile, '# Test')

    expect(() => {
      composeTags(testFile, { indentSpaces: 'abc' })
    }).toThrow('--indent-spaces must be a non-negative number')
  })

  it('should throw on invalid root tag name', () => {
    writeFileSync(testFile, '# Test')

    expect(() => {
      composeTags(testFile, { rootTagName: '123invalid' })
    }).toThrow(/Invalid tag name/)
  })

  it('should throw on invalid path strategy', () => {
    writeFileSync(testFile, '# Test')

    expect(() => {
      composeTags(testFile, { convertPathToTagStrategy: 'invalid' })
    }).toThrow(/Invalid --convert-path-to-tag-strategy value/)
  })

  describe('tag case transformations', () => {
    it('should support kebab-case transformation', () => {
      const subDir = join(testDir, 'UserComponents')
      mkdirSync(subDir, { recursive: true })
      const subFile = join(subDir, 'ProfileCard.md')
      writeFileSync(subFile, '# Profile Card')

      writeFileSync(testFile, '@@UserComponents/ProfileCard.md')

      const result = composeTags(testFile, {
        tagCase: 'kebab',
      })

      expect(result).toBe(dedent`
        <document>
          <user-components>
            # Profile Card
          </user-components>
        </document>
      `)
    })

    it('should support shout case transformation', () => {
      const subDir = join(testDir, 'ApiDocs')
      mkdirSync(subDir, { recursive: true })
      const subFile = join(subDir, 'RestEndpoints.md')
      writeFileSync(subFile, '# REST API Endpoints')

      writeFileSync(testFile, '@@ApiDocs/RestEndpoints.md')

      const result = composeTags(testFile, {
        tagCase: 'shout',
      })

      expect(result).toBe(dedent`
        <DOCUMENT>
          <APIDOCS>
            # REST API Endpoints
          </APIDOCS>
        </DOCUMENT>
      `)
    })

    it('should support meme case transformation', () => {
      writeFileSync(testFile, '# Test Document')

      const result = composeTags(testFile, {
        tagCase: 'meme',
        rootTagName: 'MyDocument',
      })

      expect(result).toBe(dedent`
        <mYdOcUmEnT>
          # Test Document
        </mYdOcUmEnT>
      `)
    })

    it('should default to pascal case', () => {
      const subDir = join(testDir, 'myFolder')
      mkdirSync(subDir, { recursive: true })
      const subFile = join(subDir, 'myFile.md')
      writeFileSync(subFile, '# My File')

      writeFileSync(testFile, '@@myFolder/myFile.md')

      const result = composeTags(testFile)

      expect(result).toBe(dedent`
        <document>
          <myFolder>
            # My File
          </myFolder>
        </document>
      `)
    })

    it('should work with multiple transformations', () => {
      const dir1 = join(testDir, 'ComponentLibrary')
      const dir2 = join(testDir, 'UtilityFunctions')
      mkdirSync(dir1, { recursive: true })
      mkdirSync(dir2, { recursive: true })

      writeFileSync(join(dir1, 'ButtonComponent.md'), '# Button Component')
      writeFileSync(join(dir2, 'StringHelpers.md'), '# String Helpers')

      writeFileSync(
        testFile,
        dedent`
        @@ComponentLibrary/ButtonComponent.md
        @@UtilityFunctions/StringHelpers.md
      `,
      )

      const result = composeTags(testFile, {
        tagCase: 'kebab',
        liftAllTagsToRoot: true,
        rootTag: false,
      })

      expect(result).toBe(dedent`
        <component-library>
          # Button Component
        </component-library>
        <utility-functions>
          # String Helpers
        </utility-functions>
      `)
    })

    it('should handle edge cases in tag names', () => {
      const dirs = [
        'XMLParser',
        'HTTPSConnection',
        'APIKey',
        'single',
        'ALLUPPER',
        'alllower',
      ]

      dirs.forEach(dir => {
        const subDir = join(testDir, dir)
        mkdirSync(subDir, { recursive: true })
        const subFile = join(subDir, 'content.md')
        writeFileSync(subFile, `# ${dir} Content`)
      })

      writeFileSync(testFile, dirs.map(d => `@@${d}/content.md`).join('\n'))

      const result = composeTags(testFile, {
        tagCase: 'kebab',
        rootTag: false,
      })

      expect(result).toContain('<xml-parser>')
      expect(result).toContain('<https-connection>')
      expect(result).toContain('<api-key>')
      expect(result).toContain('<single>')
      expect(result).toContain('<allupper>')
      expect(result).toContain('<alllower>')
    })
  })
})
