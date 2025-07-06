import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, chmodSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname, resolve } from 'path'
import { tmpdir } from 'os'
import dedent from 'dedent'

// Get absolute paths
const cliPath = resolve('./dist/cli.js')
const errorGeneratorPath = resolve('./test-helpers/error-generator.sh')

// Create a unique test directory for each test run
const testDir = join(
  tmpdir(),
  `fs-to-xml-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
)

const writeTestFile = (
  path: string,
  content: string = 'This is a test rule file.',
): void => {
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

  it('outputs simple echo command as XML', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo "foo bar"
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo "foo bar"</input>
          <stdout>foo bar</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('skips comment lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      # This is a comment
      echo hello
      # Another comment
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo hello</input>
          <stdout>hello</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('outputs multiple echo commands', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo first
      echo second
      echo "third test"
    `)

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

  it('handles empty lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo first
      
      echo second
    `)

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
    `

    expect(output.trim()).toBe(expected)
  })

  it('handles echo with no arguments', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo</input>
          <stdout />
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('handles echo with multiple arguments', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo bar baz
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo bar baz</input>
          <stdout>foo bar baz</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('outputs commands with logical AND operator', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo && echo bar
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo</input>
          <stdout>foo</stdout>
          <success code="0" />
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('outputs multiple commands with logical AND operators', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo && echo bar && echo baz
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo</input>
          <stdout>foo</stdout>
          <success code="0" />
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <success code="0" />
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo baz</input>
          <stdout>baz</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('outputs commands with logical OR operator', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo || echo bar
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo</input>
          <stdout>foo</stdout>
          <success code="0" />
        </echo>
        <logical-or-operator />
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('executes second command when first fails with OR operator', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      false || echo bar
    `)

    const expected = dedent`
      <command>
        <false>
          <input>false</input>
          <stdout />
          <failure code="1" />
        </false>
        <logical-or-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <success code="0" />
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('handles multiple OR operators with first command succeeding', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo || exit 1 || echo bar
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo</input>
          <stdout>foo</stdout>
          <success code="0" />
        </echo>
        <logical-or-operator />
        <logical-or-operator />
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('handles pipe operations', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ${cliPath}
      echo foo | grep foo
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo foo</input>
          <success code="0" />
        </echo>
        <pipe-operator />
        <grep>
          <input>grep foo</input>
          <stdout>foo</stdout>
          <success code="0" />
        </grep>
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
      writeTestFile('rules/test.md')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.md
      `)

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

    it('processes markdown file with nested directories', () => {
      writeTestFile('rules/foo/bar.md', 'This is a nested rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/foo/bar.md
      `)

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/foo/bar.md</input>
            <rules>
              <foo>
                This is a nested rule file.
              </foo>
            </rules>
            <success code="0" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })

    it('fails when fs-to-xml is used in a pipe', () => {
      writeTestFile('rules/test.md')

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
      writeTestFile('rules/test.md')

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

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/test.txt
      `)

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/test.txt</input>
            <stderr>Error: fs-to-xml only supports .md files, got .txt</stderr>
            <failure code="1" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })

    it('handles fs-to-xml with missing file', () => {
      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml rules/nonexistent.md
      `)

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml rules/nonexistent.md</input>
            <stderr>Error reading file: ENOENT: no such file or directory, open 'rules/nonexistent.md'</stderr>
            <failure code="1" />
          </fs-to-xml>
        </command>
      `

      expect(output.trim()).toBe(expected)
    })
  })

  describe('Direct markdown file processing', () => {
    it('processes markdown file directly', () => {
      writeTestFile('rules/test.md')

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
  })
})
