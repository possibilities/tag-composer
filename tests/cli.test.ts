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
          <output>foo bar</output>
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
          <output>hello</output>
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
          <output>first</output>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo second</input>
          <output>second</output>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo "third test"</input>
          <output>third test</output>
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
          <output>first</output>
        </echo>
      </command>
      <command>
        <echo>
          <input>echo second</input>
          <output>second</output>
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
          <output></output>
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
          <output>foo bar baz</output>
        </echo>
      </command>
    `

    expect(output.trim()).toBe(expected)
  })
})
