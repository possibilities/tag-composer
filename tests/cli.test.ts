import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync, chmodSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import dedent from 'dedent'

const invokeScript = (scriptContent: string): string => {
  const tmpFile = join(
    tmpdir(),
    `test-script-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
  )

  try {
    writeFileSync(tmpFile, scriptContent.trim())
    chmodSync(tmpFile, 0o755)
    return execSync(tmpFile, { encoding: 'utf8' })
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {}
  }
}

describe('FS to XML', () => {
  it('outputs simple echo command as XML', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
      #!/usr/bin/env ./dist/cli.js
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
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      ./test-helpers/error-generator.sh --exit-code 2 --stderr "Command failed"
    `)

    const expected = dedent`
      <command>
        <error-generator.sh>
          <input>./test-helpers/error-generator.sh --exit-code 2 --stderr "Command failed"</input>
          <stdout />
          <stderr>Command failed</stderr>
          <failure code="2" />
        </error-generator.sh>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('shows stderr in pipe operations', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo test | ./test-helpers/error-generator.sh --exit-code 2 --stderr "Invalid option" --stdout "filtered"
    `)

    const expected = dedent`
      <command>
        <echo>
          <input>echo test</input>
          <success code="0" />
        </echo>
        <pipe-operator />
        <error-generator.sh>
          <input>./test-helpers/error-generator.sh --exit-code 2 --stderr "Invalid option" --stdout filtered</input>
          <stdout>filtered</stdout>
          <stderr>Invalid option</stderr>
          <failure code="2" />
        </error-generator.sh>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('shows both stdout and stderr with custom exit code', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      ./test-helpers/error-generator.sh --exit-code 42 --stdout "Normal output" --stderr "Error output"
    `)

    const expected = dedent`
      <command>
        <error-generator.sh>
          <input>./test-helpers/error-generator.sh --exit-code 42 --stdout "Normal output" --stderr "Error output"</input>
          <stdout>Normal output</stdout>
          <stderr>Error output</stderr>
          <failure code="42" />
        </error-generator.sh>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })
})
