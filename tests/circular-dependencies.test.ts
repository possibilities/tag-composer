import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { detectCircularDependencies } from '../src/detect-circular-dependencies'
import dedent from 'dedent'

describe('Circular Dependency Detection', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should detect simple circular dependency', () => {
    const file1 = join(tempDir, 'file1.md')
    const file2 = join(tempDir, 'file2.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer file2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # File 2
      !!tag-composer file1.md
    `,
    )

    expect(() => detectCircularDependencies(file1)).toThrow(
      /Circular dependency detected/,
    )
    expect(() => detectCircularDependencies(file1)).toThrow(file1)
    expect(() => detectCircularDependencies(file1)).toThrow(file2)
  })

  it('should detect complex circular dependency', () => {
    const file1 = join(tempDir, 'file1.md')
    const file2 = join(tempDir, 'file2.md')
    const file3 = join(tempDir, 'file3.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer file2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # File 2
      !!tag-composer file3.md
    `,
    )

    writeFileSync(
      file3,
      dedent`
      # File 3
      !!tag-composer file1.md
    `,
    )

    expect(() => detectCircularDependencies(file1)).toThrow(
      /Circular dependency detected/,
    )
  })

  it('should not throw for non-circular dependencies', () => {
    const file1 = join(tempDir, 'file1.md')
    const file2 = join(tempDir, 'file2.md')
    const file3 = join(tempDir, 'file3.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer file2.md
      !!tag-composer file3.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # File 2
      !!echo "Hello from file2"
    `,
    )

    writeFileSync(
      file3,
      dedent`
      # File 3
      !!echo "Hello from file3"
    `,
    )

    expect(() => detectCircularDependencies(file1)).not.toThrow()
  })

  it('should handle files that include the same file multiple times', () => {
    const file1 = join(tempDir, 'file1.md')
    const file2 = join(tempDir, 'file2.md')
    const file3 = join(tempDir, 'file3.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer file2.md
      !!tag-composer file3.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # File 2
      !!tag-composer file3.md
    `,
    )

    writeFileSync(
      file3,
      dedent`
      # File 3
      !!echo "Hello from file3"
    `,
    )

    expect(() => detectCircularDependencies(file1)).not.toThrow()
  })

  it('should handle self-referencing files', () => {
    const file1 = join(tempDir, 'file1.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer file1.md
    `,
    )

    expect(() => detectCircularDependencies(file1)).toThrow(
      /Circular dependency detected/,
    )
  })

  it('should resolve relative paths correctly', () => {
    const subdir = join(tempDir, 'subdir')
    mkdirSync(subdir)

    const file1 = join(tempDir, 'file1.md')
    const file2 = join(subdir, 'file2.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer subdir/file2.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      # File 2
      !!tag-composer ../file1.md
    `,
    )

    expect(() => detectCircularDependencies(file1)).toThrow(
      /Circular dependency detected/,
    )
  })

  it('should handle missing files gracefully', () => {
    const file1 = join(tempDir, 'file1.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!tag-composer nonexistent.md
    `,
    )

    expect(() => detectCircularDependencies(file1)).not.toThrow()
  })

  it('should handle non-tag-composer commands', () => {
    const file1 = join(tempDir, 'file1.md')

    writeFileSync(
      file1,
      dedent`
      # File 1
      !!echo "Hello"
      !!ls -la
      !!pwd
    `,
    )

    expect(() => detectCircularDependencies(file1)).not.toThrow()
  })

  it('should format circular dependency error nicely', () => {
    const file1 = join(tempDir, 'a.md')
    const file2 = join(tempDir, 'b.md')
    const file3 = join(tempDir, 'c.md')

    writeFileSync(
      file1,
      dedent`
      !!tag-composer b.md
    `,
    )

    writeFileSync(
      file2,
      dedent`
      !!tag-composer c.md
    `,
    )

    writeFileSync(
      file3,
      dedent`
      !!tag-composer a.md
    `,
    )

    try {
      detectCircularDependencies(file1)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(message).toContain('Circular dependency detected:')
      expect(message).toContain('┌>')
      expect(message).toContain('├─')
      expect(message).toContain('└>')
      expect(message).toContain('a.md')
      expect(message).toContain('b.md')
      expect(message).toContain('c.md')
    }
  })
})
