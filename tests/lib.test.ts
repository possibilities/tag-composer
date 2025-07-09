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
})
