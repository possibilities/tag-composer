import dedent from 'dedent'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runPipeline } from '../src/pipeline'

describe('Path to Tag Strategy', () => {
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

  describe('all strategy (default)', () => {
    it('should include all path segments as tags', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'all',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          <docs>
            <api>
              <v1>
                API Endpoints
                GET /users
              </v1>
            </api>
          </docs>
        </document>
      `)
    })
  })

  describe('head strategy', () => {
    it('should only include the first segment', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'head',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          <docs>
            API Endpoints
            GET /users
          </docs>
        </document>
      `)
    })

    it('should handle single segment paths', () => {
      mkdirSync(join(tempDir, 'docs'))

      writeFileSync(
        join(tempDir, 'docs/readme.md'),
        dedent`
          Documentation content
        `,
      )

      const input = dedent`
        @@docs/readme.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'head',
      })

      expect(output).toBe(dedent`
        <document>
          <docs>
            Documentation content
          </docs>
        </document>
      `)
    })
  })

  describe('tail/rest strategy', () => {
    it('should include all segments except the first', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'tail',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          <api>
            <v1>
              API Endpoints
              GET /users
            </v1>
          </api>
        </document>
      `)
    })

    it('should handle rest strategy same as tail', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))

      writeFileSync(
        join(tempDir, 'docs/api/endpoints.md'),
        dedent`
          API Endpoints
        `,
      )

      const input = dedent`
        @@docs/api/endpoints.md
      `

      const outputTail = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'tail',
      })

      const outputRest = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'rest',
      })

      expect(outputTail).toBe(outputRest)
    })
  })

  describe('init strategy', () => {
    it('should include all segments except the last', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'init',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          <docs>
            <api>
              API Endpoints
              GET /users
            </api>
          </docs>
        </document>
      `)
    })
  })

  describe('last strategy', () => {
    it('should only include the last segment', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'last',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          <v1>
            API Endpoints
            GET /users
          </v1>
        </document>
      `)
    })
  })

  describe('none strategy', () => {
    it('should not wrap content in any directory tags', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))
      mkdirSync(join(tempDir, 'docs/api/v1'))

      writeFileSync(
        join(tempDir, 'docs/api/v1/endpoints.md'),
        dedent`
          API Endpoints
          GET /users
        `,
      )

      const input = dedent`
        Documentation
        @@docs/api/v1/endpoints.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'none',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation
          API Endpoints
          GET /users
        </document>
      `)
    })

    it('should handle nested references without wrapping', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))

      writeFileSync(
        join(tempDir, 'docs/api/inner.md'),
        dedent`
          Inner content
        `,
      )

      writeFileSync(
        join(tempDir, 'docs/outer.md'),
        dedent`
          Outer content
          @@api/inner.md
        `,
      )

      const input = dedent`
        @@docs/outer.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'none',
      })

      expect(output).toBe(dedent`
        <document>
          Outer content
          Inner content
        </document>
      `)
    })

    it('should work with single directory paths', () => {
      mkdirSync(join(tempDir, 'docs'))

      writeFileSync(
        join(tempDir, 'docs/readme.md'),
        dedent`
          Documentation content
        `,
      )

      const input = dedent`
        @@docs/readme.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'none',
      })

      expect(output).toBe(dedent`
        <document>
          Documentation content
        </document>
      `)
    })

    it('should handle absolute paths same as other strategies', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))

      writeFileSync(
        join(tempDir, 'docs/api/endpoints.md'),
        dedent`
          API Endpoints
        `,
      )

      const absolutePath = join(tempDir, 'docs/api/endpoints.md')
      const input = dedent`
        @@${absolutePath}
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'none',
      })

      expect(output).toBe(dedent`
        <document>
          API Endpoints
        </document>
      `)
    })
  })

  describe('edge cases', () => {
    it('should handle files in root directory (no path segments)', () => {
      writeFileSync(
        join(tempDir, 'readme.md'),
        dedent`
          Root content
        `,
      )

      const input = dedent`
        @@readme.md
      `

      const outputAll = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'all',
      })

      const outputHead = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'head',
      })

      const outputLast = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'last',
      })

      expect(outputAll).toBe(dedent`
        <document>
          Root content
        </document>
      `)

      expect(outputHead).toBe(outputAll)
      expect(outputLast).toBe(outputAll)
    })

    it('should handle absolute paths (no wrapping tags)', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))

      writeFileSync(
        join(tempDir, 'docs/api/endpoints.md'),
        dedent`
          API Endpoints
        `,
      )

      const absolutePath = join(tempDir, 'docs/api/endpoints.md')
      const input = dedent`
        @@${absolutePath}
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'head',
      })

      expect(output).toBe(dedent`
        <document>
          API Endpoints
        </document>
      `)
    })

    it('should handle nested references with different strategies', () => {
      mkdirSync(join(tempDir, 'docs'))
      mkdirSync(join(tempDir, 'docs/api'))

      writeFileSync(
        join(tempDir, 'docs/api/inner.md'),
        dedent`
          Inner content
        `,
      )

      writeFileSync(
        join(tempDir, 'docs/outer.md'),
        dedent`
          Outer content
          @@api/inner.md
        `,
      )

      const input = dedent`
        @@docs/outer.md
      `

      const output = runPipeline(input, join(tempDir, 'main.md'), {
        pathToTagStrategy: 'head',
      })

      expect(output).toBe(dedent`
        <document>
          <docs>
            Outer content
            <api>
              Inner content
            </api>
          </docs>
        </document>
      `)
    })
  })
})
