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
          <exit>0</exit>
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
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo second</input>
          <stdout>second</stdout>
          <exit>0</exit>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo "third test"</input>
          <stdout>third test</stdout>
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo second</input>
          <stdout>second</stdout>
          <exit>0</exit>
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
          <exit>0</exit>
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
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <exit>0</exit>
        </echo>
        <logical-and-operator />
        <echo>
          <input>echo baz</input>
          <stdout>baz</stdout>
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
        <logical-or-operator />
      </command>
    `

    expect(output.trim()).toBe(expected)
  })

  it('executes second command when first fails with OR operator', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      exit 1 || echo bar
    `)

    const expected = dedent`
      <command>
        <exit>
          <input>exit 1</input>
          <stdout />
          <exit>1</exit>
        </exit>
        <logical-or-operator />
        <echo>
          <input>echo bar</input>
          <stdout>bar</stdout>
          <exit>0</exit>
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
          <exit>0</exit>
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
          <exit>0</exit>
        </echo>
        <pipe-operator />
        <grep>
          <input>grep foo</input>
          <stdout>foo</stdout>
          <exit>0</exit>
        </grep>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })
})
