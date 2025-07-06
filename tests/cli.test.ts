import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, chmodSync, mkdirSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname, resolve } from 'path'
import { tmpdir } from 'os'
import dedent from 'dedent'

const cliPath = resolve('./dist/cli.js')
const errorGeneratorPath = resolve('./test-helpers/error-generator.sh')

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
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ./rules/test.md
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
        fs-to-xml ./rules/foo/bar.md
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
          echo foo | fs-to-xml ./rules/test.md
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
          fs-to-xml ./rules/test.md && echo done
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
          fs-to-xml ./rules/test.txt
        `)
      } catch (e: any) {
        error = e.stderr || e.message
      }

      expect(error.trim()).toBe(
        'Error: fs-to-xml only supports .md files, got .txt',
      )
    })

    it('handles fs-to-xml with missing file', () => {
      let error = ''
      try {
        invokeScript(dedent`
          #!/usr/bin/env ${cliPath}
          fs-to-xml ./rules/nonexistent.md
        `)
      } catch (e: any) {
        error = e.stderr || e.message
      }

      expect(error.trim()).toBe(
        "Error: fs-to-xml failed - ENOENT: no such file or directory, open './rules/nonexistent.md'",
      )
    })
  })

  describe('Mixed fs-to-xml scenarios', () => {
    it('processes regular commands normally alongside fs-to-xml in shebang mode', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        echo "Starting process"
        fs-to-xml ./rules/test.md
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
      writeTestFile('script.sh', 'fs-to-xml ./rules/test.md')

      const output = execSync(`${cliPath} script.sh`, {
        encoding: 'utf8',
        cwd: testDir,
      })

      const expected = dedent`
        <command>
          <fs-to-xml>
            <input>fs-to-xml ./rules/test.md</input>
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
  })

  describe('Path resolution in shebang mode', () => {
    it('resolves absolute paths as-is', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')
      const absolutePath = join(testDir, 'rules/test.md')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ${absolutePath}
      `)

      // For absolute paths, the full directory structure is shown
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

    it('resolves explicit relative paths (./...) relative to CWD', () => {
      writeTestFile('rules/test.md', 'This is a test rule file.')

      const output = invokeScript(dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml ./rules/test.md
      `)

      const expected = dedent`
        <rules>
          This is a test rule file.
        </rules>
      `

      expect(output.trim()).toBe(expected)
    })

    it('resolves implicit relative paths relative to script location', () => {
      // Write the actual script and data files
      writeTestFile(
        'scripts/subdir/script.sh',
        dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml data/test.md
      `,
      )
      writeTestFile('scripts/subdir/data/test.md', 'Script-relative content')
      chmodSync(join(testDir, 'scripts/subdir/script.sh'), 0o755)

      // Create a temporary script in /tmp that will execute our test script
      // This simulates the invokeScript behavior
      const tmpScript = join(tmpdir(), 'test-implicit-path.sh')
      writeFileSync(
        tmpScript,
        dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml data/test.md
      `,
      )
      chmodSync(tmpScript, 0o755)

      // Create data file relative to the tmp script
      const tmpDataDir = join(dirname(tmpScript), 'data')
      mkdirSync(tmpDataDir, { recursive: true })
      writeFileSync(join(tmpDataDir, 'test.md'), 'Script-relative content')

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

      // Cleanup
      try {
        unlinkSync(tmpScript)
        rmSync(tmpDataDir, { recursive: true })
      } catch {}
    })

    it('handles mixed path types in the same script', () => {
      // Create a temporary script that tests all three path types
      const tmpScript = join(tmpdir(), 'test-mixed-paths.sh')

      // Create test files
      writeTestFile('explicit/relative.md', 'Explicit relative content')
      writeTestFile('absolute/path.md', 'Absolute path content')

      // Create data file relative to the tmp script location
      const tmpDataDir = join(dirname(tmpScript), 'data')
      mkdirSync(tmpDataDir, { recursive: true })
      writeFileSync(
        join(tmpDataDir, 'implicit.md'),
        'Implicit relative content',
      )

      writeFileSync(
        tmpScript,
        dedent`
        #!/usr/bin/env ${cliPath}
        echo "Testing path resolution"
        fs-to-xml data/implicit.md
        fs-to-xml ./explicit/relative.md
        fs-to-xml ${join(testDir, 'absolute/path.md')}
      `,
      )
      chmodSync(tmpScript, 0o755)

      const output = execSync(tmpScript, {
        encoding: 'utf8',
        cwd: testDir,
      })

      // Build expected output with proper handling of absolute path
      const absolutePathParts = dirname(join(testDir, 'absolute/path.md'))
        .split('/')
        .filter(p => p && p !== '.')
      let absoluteXml = ''
      let indent = ''

      absolutePathParts.forEach(part => {
        absoluteXml += `${indent}<${part}>\n`
        indent += '  '
      })

      absoluteXml += `${indent}Absolute path content`

      for (let i = absolutePathParts.length - 1; i >= 0; i--) {
        absoluteXml += `\n${indent.slice(0, -2)}</${absolutePathParts[i]}>`
        indent = indent.slice(0, -2)
      }

      const expected = [
        '<command>',
        '  <echo>',
        '    <input>echo "Testing path resolution"</input>',
        '    <stdout>Testing path resolution</stdout>',
        '    <success code="0" />',
        '  </echo>',
        '</command>',
        '<data>',
        '  Implicit relative content',
        '</data>',
        '<explicit>',
        '  Explicit relative content',
        '</explicit>',
        absoluteXml,
      ].join('\n')

      expect(output.trim()).toBe(expected.trim())

      // Cleanup
      try {
        unlinkSync(tmpScript)
        rmSync(tmpDataDir, { recursive: true })
      } catch {}
    })

    it('maintains correct behavior when script is run from different directory', () => {
      // Create script in a known location
      const scriptDir = join(testDir, 'scripts')
      mkdirSync(scriptDir, { recursive: true })
      const scriptPath = join(scriptDir, 'script.sh')

      // Create data relative to script
      const dataDir = join(scriptDir, 'data')
      mkdirSync(dataDir, { recursive: true })
      writeFileSync(join(dataDir, 'test.md'), 'Script-relative content')

      writeFileSync(
        scriptPath,
        dedent`
        #!/usr/bin/env ${cliPath}
        fs-to-xml data/test.md
      `,
      )
      chmodSync(scriptPath, 0o755)

      // Create a working directory and run from there
      const workDir = join(testDir, 'workdir')
      mkdirSync(workDir, { recursive: true })

      const output = execSync('../scripts/script.sh', {
        encoding: 'utf8',
        cwd: workDir,
      })

      const expected = dedent`
        <data>
          Script-relative content
        </data>
      `

      expect(output.trim()).toBe(expected)
    })
  })
})
