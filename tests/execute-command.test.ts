import { describe, it, expect } from 'vitest'
import { executeCommand } from '../src/execute-command'

describe('executeCommand', () => {
  it('should execute successful command and capture stdout', () => {
    const result = executeCommand('echo "hello world"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('hello world\n')
    expect(result.stderr).toBe('')
  })

  it('should capture stderr for commands that write to stderr', () => {
    const result = executeCommand('sh -c "echo error >&2"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('error\n')
  })

  it('should capture non-zero exit codes', () => {
    const result = executeCommand('exit 42')

    expect(result.statusCode).toBe(42)
  })

  it('should handle commands that fail', () => {
    const result = executeCommand('false')

    expect(result.statusCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('should handle commands with both stdout and stderr', () => {
    const result = executeCommand('sh -c "echo stdout && echo stderr >&2"')

    expect(result.statusCode).toBe(0)
    expect(result.stdout).toBe('stdout\n')
    expect(result.stderr).toBe('stderr\n')
  })

  it('should handle commands that do not exist', () => {
    const result = executeCommand('nonexistentcommand12345')

    expect(result.statusCode).not.toBe(0)
    expect(result.stderr.toLowerCase()).toMatch(
      /command not found|permission denied|not found/,
    )
  })
})
