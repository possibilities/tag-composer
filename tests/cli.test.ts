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

    expect(output).toContain('<command>')
    expect(output).toContain('<echo>')
    expect(output).toContain('<input>echo "foo bar"</input>')
    expect(output).toContain('<output>foo bar</output>')
    expect(output).toContain('</echo>')
    expect(output).toContain('</command>')
  })

  it('skips comment lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      # This is a comment
      echo hello
      # Another comment
    `)

    expect(output).toContain('<command>')
    expect(output).toContain('<echo>')
    expect(output).toContain('<input>echo hello</input>')
    expect(output).toContain('<output>hello</output>')
    expect(output).not.toContain('comment')
  })

  it('outputs multiple echo commands', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo first
      echo second
      echo "third test"
    `)

    expect(output).toContain('<input>echo first</input>')
    expect(output).toContain('<output>first</output>')
    expect(output).toContain('<input>echo second</input>')
    expect(output).toContain('<output>second</output>')
    expect(output).toContain('<input>echo "third test"</input>')
    expect(output).toContain('<output>third test</output>')

    const commandCount = (output.match(/<command>/g) || []).length
    expect(commandCount).toBe(3)
  })

  it('handles empty lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo first
      
      echo second
    `)

    expect(output).toContain('<input>echo first</input>')
    expect(output).toContain('<output>first</output>')
    expect(output).toContain('<input>echo second</input>')
    expect(output).toContain('<output>second</output>')

    const commandCount = (output.match(/<command>/g) || []).length
    expect(commandCount).toBe(2)
  })

  it('handles echo with no arguments', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo
    `)

    expect(output).toContain('<command>')
    expect(output).toContain('<echo>')
    expect(output).toContain('<input>echo</input>')
    expect(output).toContain('<output></output>')
  })

  it('handles echo with multiple arguments', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo foo bar baz
    `)

    expect(output).toContain('<command>')
    expect(output).toContain('<echo>')
    expect(output).toContain('<input>echo foo bar baz</input>')
    expect(output).toContain('<output>foo bar baz</output>')
  })
})
