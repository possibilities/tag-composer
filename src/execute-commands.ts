import { spawnSync } from 'child_process'
import {
  getTypeName,
  ParsedLine,
  ExecutionResult,
  CommandLine,
  isCommandLine,
} from './types.js'

export function executeCommand(command: string): ExecutionResult {
  const result = spawnSync('sh', ['-c', command], {
    encoding: 'utf8',
    shell: false,
  })

  return {
    statusCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

export function executeCommands(lines: ParsedLine[]): ParsedLine[] {
  return lines.map(line => {
    const newLine = { ...line }

    if (
      isCommandLine(line) &&
      getTypeName(line.type) === 'command' &&
      line.input
    ) {
      const result = executeCommand(line.input)
      const commandLine = newLine as CommandLine
      commandLine.exit = {
        name: 'exit',
        attrs: {
          status: result.statusCode === 0 ? 'success' : 'failure',
          code: result.statusCode.toString(),
        },
      }
      commandLine.stdout = result.stdout
      commandLine.stderr = result.stderr
    }

    if (line.children && Array.isArray(line.children)) {
      newLine.children = executeCommands(line.children)
    }

    return newLine
  })
}
