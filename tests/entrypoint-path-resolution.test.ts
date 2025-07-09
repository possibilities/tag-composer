import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { composeTags } from '../src/lib.js'
import { join } from 'path'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import dedent from 'dedent'

describe('Entrypoint Path Resolution', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tag-composer-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true })
  })

  it('should resolve all paths relative to entrypoint with deep nesting', () => {
    // Create a deeply nested structure
    mkdirSync(join(tempDir, 'docs'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'guides'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'guides', 'advanced'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'api'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'api', 'v2'), { recursive: true })
    mkdirSync(join(tempDir, 'shared'), { recursive: true })

    // Create files at various levels
    writeFileSync(
      join(tempDir, 'docs', 'index.md'),
      dedent`
        # Main Documentation
        @@guides/intro.md
        @@../shared/footer.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'guides', 'intro.md'),
      dedent`
        # Introduction
        @@guides/advanced/setup.md
        @@api/overview.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'guides', 'advanced', 'setup.md'),
      dedent`
        # Advanced Setup
        @@api/v2/endpoints.md
        @@../shared/notice.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'api', 'overview.md'),
      dedent`
        # API Overview
        General API information
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'api', 'v2', 'endpoints.md'),
      dedent`
        # V2 Endpoints
        REST API endpoints
      `,
    )

    writeFileSync(
      join(tempDir, 'shared', 'footer.md'),
      dedent`
        # Footer
        Copyright notice
      `,
    )

    writeFileSync(
      join(tempDir, 'shared', 'notice.md'),
      dedent`
        # Notice
        Important information
      `,
    )

    const output = composeTags(join(tempDir, 'docs', 'index.md'))

    expect(output).toBe(dedent`
      <document>
        # Main Documentation
        <guides>
          # Introduction
          <guides>
            <advanced>
              # Advanced Setup
              <api>
                <v2>
                  # V2 Endpoints
                  REST API endpoints
                </v2>
              </api>
              <shared>
                # Notice
                Important information
              </shared>
            </advanced>
          </guides>
          <api>
            # API Overview
            General API information
          </api>
        </guides>
        <shared>
          # Footer
          Copyright notice
        </shared>
      </document>
    `)
  })

  it('should handle mixed absolute and relative paths', () => {
    mkdirSync(join(tempDir, 'project'), { recursive: true })
    mkdirSync(join(tempDir, 'project', 'docs'), { recursive: true })
    mkdirSync(join(tempDir, 'external'), { recursive: true })

    const absoluteExternalPath = join(tempDir, 'external', 'resource.md')

    writeFileSync(
      join(tempDir, 'project', 'main.md'),
      dedent`
        # Main File
        @@docs/relative.md
        @@${absoluteExternalPath}
      `,
    )

    writeFileSync(
      join(tempDir, 'project', 'docs', 'relative.md'),
      dedent`
        # Relative Content
        @@docs/nested.md
      `,
    )

    writeFileSync(
      join(tempDir, 'project', 'docs', 'nested.md'),
      dedent`
        # Nested Content
        @@${absoluteExternalPath}
      `,
    )

    writeFileSync(
      absoluteExternalPath,
      dedent`
        # External Resource
        Absolute path content
      `,
    )

    const output = composeTags(join(tempDir, 'project', 'main.md'))

    expect(output).toBe(dedent`
      <document>
        # Main File
        <docs>
          # Relative Content
          <docs>
            # Nested Content
            # External Resource
            Absolute path content
          </docs>
        </docs>
        # External Resource
        Absolute path content
      </document>
    `)
  })

  it('should maintain consistent paths across different entry points', () => {
    mkdirSync(join(tempDir, 'a'), { recursive: true })
    mkdirSync(join(tempDir, 'b'), { recursive: true })
    mkdirSync(join(tempDir, 'shared'), { recursive: true })

    writeFileSync(
      join(tempDir, 'a', 'doc.md'),
      dedent`
        # A Document
        @@../shared/common.md
      `,
    )

    writeFileSync(
      join(tempDir, 'b', 'doc.md'),
      dedent`
        # B Document
        @@../shared/common.md
      `,
    )

    writeFileSync(
      join(tempDir, 'shared', 'common.md'),
      dedent`
        # Common Content
        Shared between A and B
      `,
    )

    // Entry from a/doc.md
    const outputA = composeTags(join(tempDir, 'a', 'doc.md'))
    expect(outputA).toContain('<shared>')
    expect(outputA).toContain('# Common Content')

    // Entry from b/doc.md
    const outputB = composeTags(join(tempDir, 'b', 'doc.md'))
    expect(outputB).toContain('<shared>')
    expect(outputB).toContain('# Common Content')
  })

  it('should work with path strategies on deeply nested references', () => {
    mkdirSync(join(tempDir, 'docs'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'api'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'api', 'v1'), { recursive: true })
    mkdirSync(join(tempDir, 'docs', 'guides'), { recursive: true })

    writeFileSync(
      join(tempDir, 'index.md'),
      dedent`
        # Root
        @@docs/overview.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'overview.md'),
      dedent`
        # Overview
        @@docs/api/intro.md
        @@docs/guides/start.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'api', 'intro.md'),
      dedent`
        # API Intro
        @@docs/api/v1/endpoints.md
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'api', 'v1', 'endpoints.md'),
      dedent`
        # V1 Endpoints
        GET /users
      `,
    )

    writeFileSync(
      join(tempDir, 'docs', 'guides', 'start.md'),
      dedent`
        # Getting Started
        @@docs/api/v1/endpoints.md
      `,
    )

    const output = composeTags(join(tempDir, 'index.md'), {
      convertPathToTagStrategy: 'last',
    })

    expect(output).toBe(dedent`
      <document>
        # Root
        <docs>
          # Overview
          <api>
            # API Intro
            <v1>
              # V1 Endpoints
              GET /users
            </v1>
          </api>
          <guides>
            # Getting Started
            <v1>
              # V1 Endpoints
              GET /users
            </v1>
          </guides>
        </docs>
      </document>
    `)
  })
})
