import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, chmodSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname, resolve, basename } from 'path'
import { tmpdir } from 'os'
import dedent from 'dedent'

const cliPath = resolve('./dist/cli.js')
const errorGeneratorPath = resolve('./tests/helpers/error-generator.sh')

const testDir = join(
  tmpdir(),
  `fs-to-xml-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
)

const writeTestFile = (path: string, content: string): void => {
  const fullPath = join(testDir, path)
  const dir = dirname(fullPath)
  mkdirSync(dir, { recursive: true })
  writeFileSync(fullPath, content)
}

const invokeScript = (scriptContent: string): string => {
  const tmpFile = join(
    tmpdir(),
    `test-script-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
  )

  try {
    writeFileSync(tmpFile, scriptContent.trim())
    chmodSync(tmpFile, 0o755)
    return execSync(tmpFile, { encoding: 'utf8', cwd: testDir })
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {}
  }
}

describe('FS to XML', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('tests CLI with --no-flatten flag', () => {
    writeTestFile(
      'script.sh',
      dedent`
      echo first
      echo second
      echo "third test"
    `,
    )

    const output = execSync(`${cliPath} --no-flatten script.sh`, {
      encoding: 'utf8',
      cwd: testDir,
    })

    const expected = dedent`
      <command>
        <echo>
          <input>echo first</input>
          <stdout>first</stdout>
          <success code="0" />
        </echo>
      </command>
      <command>
        <echo>
          <input>echo second</input>
          <stdout>second</stdout>
          <success code="0" />
        </echo>
      </command>
      <command>
        <echo>
          <input>echo "third test"</input>
          <stdout>third test</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('captures stderr output when commands fail', () => {
    const output = invokeScript(
      dedent(`
      #!/usr/bin/env ${cliPath}
      ${errorGeneratorPath} --exit-code 2 --stderr "Command failed"
    `),
    )

    const expected = dedent(`
      <command>
        <error-generator.sh>
          <input>${errorGeneratorPath} --exit-code 2 --stderr "Command failed"</input>
          <stdout />
          <stderr>Command failed</stderr>
          <failure code="2" />
        </error-generator.sh>
      </command>
    `)

    expect(output.trim()).toBe(expected)
  })

  it('shows stderr in pipe operations', () => {
    const output = invokeScript(
      dedent(`
      #!/usr/bin/env ${cliPath}
      echo test | ${errorGeneratorPath} --exit-code 2 --stderr "Invalid option" --stdout "filtered"
    `),
    )

    const expected = dedent(`
      <command>
        <echo>
          <input>echo test</input>
          <success code="0" />
        </echo>
        <pipe-operator />
        <error-generator.sh>
          <input>${errorGeneratorPath} --exit-code 2 --stderr "Invalid option" --stdout filtered</input>
          <stdout>filtered</stdout>
          <stderr>Invalid option</stderr>
          <failure code="2" />
        </error-generator.sh>
      </command>
    `)

    expect(output.trim()).toBe(expected)
  })

  it('shows both stdout and stderr with custom exit code', () => {
    const output = invokeScript(
      dedent(`
      #!/usr/bin/env ${cliPath}
      ${errorGeneratorPath} --exit-code 42 --stdout "Normal output" --stderr "Error output"
    `),
    )

    const expected = dedent(`
      <command>
        <error-generator.sh>
          <input>${errorGeneratorPath} --exit-code 42 --stdout "Normal output" --stderr "Error output"</input>
          <stdout>Normal output</stdout>
          <stderr>Error output</stderr>
          <failure code="42" />
        </error-generator.sh>
      </command>
    `)

    expect(output.trim()).toBe(expected)
  })

  describe('fs-to-xml special command', () => {
    it('processes markdown file with single directory', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

      const expected = dedent`
        <rules>
          This is a test rule file.
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('processes markdown file with nested directories', () => {
      writeTestFile('rules/foo/bar.md', 'This is a nested rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/foo/bar.md
      `)

      const expected = dedent`
        <rules>
          <foo>
            This is a nested rule file.
          </foo>
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('fails when fs-to-xml is used in a pipe', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      let error = ''
      try {
        invokeScript(dedent`
          #!/usr/bin/env ${cliPath}
          echo foo | fs-to-xml rules/test.md
        `)
      } catch (e: any) {
        error = e.message
      }

      expect(error).toContain('fs-to-xml cannot be used in pipe operations')
    })

    it('fails when fs-to-xml is used with logical operators', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      let error = ''
      try {
        invokeScript(dedent`
          #!/usr/bin/env ${cliPath}
          fs-to-xml rules/test.md && echo done
        `)
      } catch (e: any) {
        error = e.message
      }

      expect(error).toContain('fs-to-xml cannot be used with logical operators')
    })

    it('handles fs-to-xml with non-markdown file', () => {
      writeTestFile('rules/test.txt', 'This is a text file.')

      let error = ''
      try {
        invokeScript(dedent`
          #!/usr/bin/env ${cliPath}
          fs-to-xml rules/test.txt
        `)
      } catch (e: any) {
        error = e.stderr || e.message
      }

      expect(error.trim()).toContain(
        'Error: fs-to-xml only supports .md files, got .txt',
      )
    })

    it('handles fs-to-xml with missing file', () => {
      let error = ''
      try {
        invokeScript(dedent`
          #!/usr/bin/env ${cliPath}
          fs-to-xml rules/nonexistent.md
        `)
      } catch (e: any) {
        error = e.stderr || e.message
      }

      expect(error.trim()).toContain(
        "Error: fs-to-xml failed - ENOENT: no such file or directory, open 'rules/nonexistent.md'",
      )
    })

    it('properly indents multi-line content in shebang mode', () => {
      const multiLineContent = dedent`
        - First rule
          - Sub rule one
          - Sub rule two
        - Second rule
      `
      writeTestFile('rules/test.md', multiLineContent)

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

      const expected = dedent`
        <rules>
          - First rule
            - Sub rule one
            - Sub rule two
          - Second rule
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('strips empty lines in fs-to-xml shebang mode', () => {
      const contentWithEmptyLines = dedent`
        Line one

        Line two


        Line three
      `
      writeTestFile('rules/test.md', contentWithEmptyLines)

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

      const expected = dedent`
        <rules>
          Line one
          Line two
          Line three
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles multi-line content in non-shebang mode', () => {
      const multiLineContent = dedent`
        Content line 1
        Content line 2
        Content line 3
      `
      writeTestFile('rules/test.md', multiLineContent)
      writeTestFile('script.sh', 'fs-to-xml rules/test.md')

      const output = execSync(`${cliPath} script.sh`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/test.md</input>
            <rules>
              Content line 1
              Content line 2
              Content line 3
            </rules>
            <success code="0" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })
  })

  describe('Mixed fs-to-xml scenarios', () => {
    it('processes regular commands normally alongside fs-to-xml in shebang mode', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        echo "Starting process"
        fs-to-xml rules/test.md
        echo "Process complete"
      `)

      const expected = dedent`
        <command>
          <echo>
            <input>echo "Starting process"</input>
            <stdout>Starting process</stdout>
            <success code="0" />
          </echo>
        </command>
        <rules>
          This is a test rule file.
        </rules>
        <command>
          <echo>
            <input>echo "Process complete"</input>
            <stdout>Process complete</stdout>
            <success code="0" />
          </echo>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })

    it('processes fs-to-xml without shebang mode normally', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')
      writeTestFile('script.sh', 'fs-to-xml rules/test.md')

      const output = execSync(`${cliPath} script.sh`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/test.md</input>
            <rules>
              This is a test rule file.
            </rules>
            <success code="0" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })
  })

  describe('Direct markdown file processing', () => {
    it('processes markdown file directly', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = execSync(`${cliPath} rules/test.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          This is a test rule file.
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('processes nested markdown file directly', () => {
      writeTestFile('rules/foo/bar.md', 'This is a nested rule file.')

      const output = execSync(`${cliPath} rules/foo/bar.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          <foo>
            This is a nested rule file.
          </foo>
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('properly indents multi-line content', () => {
      const multiLineContent = dedent`
        You are an experienced software engineer who is product focused
        - Always come with an open mind, a zen mind, a beginners mind
        - Before doing any work think deeply and make a clear plan to follow
        - Obsessively serve people and make them happy with a simple, minimilistic, approach to software, technology, UIs, and UX
          - Prioritize people, users, product, and design
      `
      writeTestFile('rules/test.md', multiLineContent)

      const output = execSync(`${cliPath} rules/test.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          You are an experienced software engineer who is product focused
          - Always come with an open mind, a zen mind, a beginners mind
          - Before doing any work think deeply and make a clear plan to follow
          - Obsessively serve people and make them happy with a simple, minimilistic, approach to software, technology, UIs, and UX
            - Prioritize people, users, product, and design
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('strips empty lines from content', () => {
      const contentWithEmptyLines = dedent`
        First line

        Second line


        Third line
      `
      writeTestFile('rules/test.md', contentWithEmptyLines)

      const output = execSync(`${cliPath} rules/test.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          First line
          Second line
          Third line
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('preserves original indentation within lines', () => {
      const contentWithIndentation = dedent`
        - Top level item
            - Deeply indented item
          - Medium indented item
        - Another top level item
      `
      writeTestFile('rules/test.md', contentWithIndentation)

      const output = execSync(`${cliPath} rules/test.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          - Top level item
              - Deeply indented item
            - Medium indented item
          - Another top level item
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles multi-line content in nested directories', () => {
      const multiLineContent = dedent`
        Line one
        Line two
        Line three
      `
      writeTestFile('rules/foo/bar.md', multiLineContent)

      const output = execSync(`${cliPath} rules/foo/bar.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <rules>
          <foo>
            Line one
            Line two
            Line three
          </foo>
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })
  })

  describe('CLI-specific behavior', () => {
    it('respects --no-flatten flag', () => {
      writeTestFile(
        'script.sh',
        dedent`
        echo first
        echo second
        echo third
      `,
      )

      const output = execSync(`${cliPath} --no-flatten script.sh`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <command>
          <echo>
            <input>echo first</input>
            <stdout>first</stdout>
            <success code="0" />
          </echo>
        </command>
        <command>
          <echo>
            <input>echo second</input>
            <stdout>second</stdout>
            <success code="0" />
          </echo>
        </command>
        <command>
          <echo>
            <input>echo third</input>
            <stdout>third</stdout>
            <success code="0" />
          </echo>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })

    it('exits with error code when script has parse errors', () => {
      writeTestFile('script.sh', 'echo test > output.txt') // Redirections are not supported

      expect(() => {
        execSync(`${cliPath} script.sh`, {
          encoding: 'utf8',
          cwd: testDir,
        })
      }).toThrow()
    })
  })

  describe('Markdown with !! commands', () => {
    it('processes !! commands in markdown files in shebang mode', () => {
      const markdownContent = dedent`
        This is a regular line
        !! echo "This is from a command"
        Another regular line
      `
      writeTestFile('rules/test.md', markdownContent)

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

      const expected = dedent`
        <rules>
          This is a regular line
          <command>
            <echo>
              <input>echo "This is from a command"</input>
              <stdout>This is from a command</stdout>
              <success code="0" />
            </echo>
          </command>
          Another regular line
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles !! with fs-to-xml command', () => {
      writeTestFile('data/nested.md', 'Nested content')
      const markdownContent = dedent`
        Start
        !! fs-to-xml data/nested.md
        End
      `
      writeTestFile('rules/test.md', markdownContent)

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

      const expected = dedent`
        <rules>
          Start
          <data>
            Nested content
          </data>
          End
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('does not process !! commands in non-shebang mode', () => {
      const markdownContent = dedent`
        This is a regular line
        !! echo "This should NOT be processed"
        Another regular line
      `
      writeTestFile('rules/test.md', markdownContent)
      writeTestFile('script.sh', 'fs-to-xml rules/test.md')

      const output = execSync(`${cliPath} script.sh`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/test.md</input>
            <rules>
              This is a regular line
              !! echo "This should NOT be processed"
              Another regular line
            </rules>
            <success code="0" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles complex nested directories with !! commands', () => {
      const markdownContent = dedent`
        Start of doc
        !! echo "In nested directory"
        End of doc
      `
      writeTestFile('docs/api/v2/test.md', markdownContent)

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml docs/api/v2/test.md
      `)

      const expected = dedent`
        <docs>
          <api>
            <v2>
              Start of doc
              <command>
                <echo>
                  <input>echo "In nested directory"</input>
                  <stdout>In nested directory</stdout>
                  <success code="0" />
                </echo>
              </command>
              End of doc
            </v2>
          </api>
        </docs>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles !! fs-to-xml commands as siblings in shebang markdown files', () => {
      writeTestFile('rules/rule1.md', 'Rule 1 content')
      writeTestFile('rules/rule2.md', 'Rule 2 content')

      const markdownContent = dedent`
        #!/usr/bin/env fs-to-xml
        Main content
        !!fs-to-xml ../rules/rule1.md
        !!fs-to-xml ../rules/rule2.md
        More content
      `
      writeTestFile('docs/main.md', markdownContent)

      const output = execSync(`${cliPath} docs/main.md`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <docs>
          Main content
          More content
        </docs>
        <rules>
          Rule 1 content
          Rule 2 content
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })
  })

  describe('Path resolution in shebang mode', () => {
    it('resolves absolute paths as-is', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')
      const absolutePath = join(testDir, 'rules/test.md')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ${absolutePath}
      `)

      const pathParts = dirname(absolutePath)
        .split('/')
        .filter(p => p && p !== '.')
      let expectedXml = ''
      let indent = ''

      pathParts.forEach(part => {
        expectedXml += `${indent}<${part}>\n`
        indent += '  '
      })

      expectedXml += `${indent}This is a test rule file.`

      for (let i = pathParts.length - 1; i >= 0; i--) {
        expectedXml += `\n${indent.slice(0, -2)}</${pathParts[i]}>`
        indent = indent.slice(0, -2)
      }

      expect(output.trim()).toBe(expectedXml)
    })

    it('resolves explicit relative paths (./...) relative to script location', () => {
      const tmpScript = join(tmpdir(), 'test-explicit-path.sh')

      const tmpDataDir = join(dirname(tmpScript), 'data')
      mkdirSync(tmpDataDir, { recursive: true })
      writeFileSync(join(tmpDataDir, 'test.md'), 'Script-relative content')

      writeFileSync(
        tmpScript,
        dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ./data/test.md
      `,
      )
      chmodSync(tmpScript, 0o755)

      const output = execSync(tmpScript, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <data>
          Script-relative content
        </data>
      `

      expect(output.trim()).toBe(expected)

      try {
        unlinkSync(tmpScript)
        rmSync(tmpDataDir, { recursive: true })
      } catch {}
    })

    it('resolves implicit relative paths relative to CWD', () => {
      writeTestFile('data/test.md', 'CWD-relative content')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml data/test.md
      `)

      const expected = dedent`
        <data>
          CWD-relative content
        </data>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles mixed path types in the same script', () => {
      const tmpScript = join(tmpdir(), 'test-mixed-paths.sh')

      writeTestFile('implicit/relative.md', 'Implicit relative content')
      writeTestFile('absolute/path.md', 'Absolute path content')

      const tmpDataDir = join(dirname(tmpScript), 'explicit')
      mkdirSync(tmpDataDir, { recursive: true })
      writeFileSync(
        join(tmpDataDir, 'relative.md'),
        'Explicit relative content',
      )

      writeFileSync(
        tmpScript,
        dedent`
        #!/usr/bin/env ${cliPath}
        echo "Testing path resolution"
        fs-to-xml implicit/relative.md
        fs-to-xml ./explicit/relative.md
        fs-to-xml ${join(testDir, 'absolute/path.md')}
      `,
      )
      chmodSync(tmpScript, 0o755)

      const output = execSync(tmpScript, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const testDirName = basename(testDir)

      const expected = dedent`
        <command>
          <echo>
            <input>echo "Testing path resolution"</input>
            <stdout>Testing path resolution</stdout>
            <success code="0" />
          </echo>
        </command>
        <implicit>
          Implicit relative content
        </implicit>
        <explicit>
          Explicit relative content
        </explicit>
        <tmp>
          <${testDirName}>
            <absolute>
              Absolute path content
            </absolute>
          </${testDirName}>
        </tmp>
      `

      expect(output.trim()).toBe(expected)

      try {
        unlinkSync(tmpScript)
        rmSync(tmpDataDir, { recursive: true })
      } catch {}
    })

    it('maintains correct behavior when script is run from different directory', () => {
      const scriptDir = join(testDir, 'scripts')
      mkdirSync(scriptDir, { recursive: true })
      const scriptPath = join(scriptDir, 'script.sh')

      const scriptDataDir = join(scriptDir, 'data')
      mkdirSync(scriptDataDir, { recursive: true })
      writeFileSync(join(scriptDataDir, 'test.md'), 'Script-relative content')

      const workDir = join(testDir, 'workdir')
      mkdirSync(workDir, { recursive: true })

      const workDataDir = join(workDir, 'other')
      mkdirSync(workDataDir, { recursive: true })
      writeFileSync(join(workDataDir, 'test.md'), 'CWD-relative content')

      writeFileSync(
        scriptPath,
        dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ./data/test.md
        fs-to-xml other/test.md
      `,
      )
      chmodSync(scriptPath, 0o755)

      const output = execSync('../scripts/script.sh', {
        encoding: 'utf8',
        cwd: workDir,
      })

      const expected = dedent`
        <data>
          Script-relative content
        </data>
        <other>
          CWD-relative content
        </other>
      `

      expect(output.trim()).toBe(expected)
    })
  })
})
