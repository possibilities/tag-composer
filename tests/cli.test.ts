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
  it('parses simple bash command', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo hello world
    `)

    const ast = JSON.parse(output)
    expect(ast.type).toBe('Script')
    expect(ast.commands).toHaveLength(1)
    expect(ast.commands[0].type).toBe('Command')
    expect(ast.commands[0].name.text).toBe('echo')
  })

  it('skips comment lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      # This is a comment
      echo hello
      # Another comment
    `)

    const ast = JSON.parse(output)
    expect(ast.type).toBe('Script')
    expect(ast.commands).toHaveLength(1)
    expect(ast.commands[0].name.text).toBe('echo')
  })

  it('parses multiple commands', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      ls -la
      cd /tmp
      echo "test"
    `)

    const jsonObjects = output
      .trim()
      .split(/}\n{/)
      .map((obj, i, arr) => {
        if (i === 0) return obj + '}'
        if (i === arr.length - 1) return '{' + obj
        return '{' + obj + '}'
      })

    expect(jsonObjects).toHaveLength(3)

    const ast1 = JSON.parse(jsonObjects[0])
    expect(ast1.commands[0].name.text).toBe('ls')

    const ast2 = JSON.parse(jsonObjects[1])
    expect(ast2.commands[0].name.text).toBe('cd')

    const ast3 = JSON.parse(jsonObjects[2])
    expect(ast3.commands[0].name.text).toBe('echo')
  })

  it('handles empty lines', () => {
    const output = invokeScript(dedent`
      #!/usr/bin/env ./dist/cli.js
      echo first
      
      echo second
    `)

    const jsonObjects = output
      .trim()
      .split(/}\n{/)
      .map((obj, i, arr) => {
        if (i === 0) return obj + '}'
        if (i === arr.length - 1) return '{' + obj
        return '{' + obj + '}'
      })

    expect(jsonObjects).toHaveLength(2)

    const ast1 = JSON.parse(jsonObjects[0])
    expect(ast1.commands[0].name.text).toBe('echo')

    const ast2 = JSON.parse(jsonObjects[1])
    expect(ast2.commands[0].name.text).toBe('echo')
  })
})
