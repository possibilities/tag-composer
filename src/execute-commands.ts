import { spawnSync } from 'child_process'

export interface ExecutionResult {
  statusCode: number
  stdout: string
  stderr: string
}

interface ParsedLine {
  type: string
  content?: string
  commandName?: string
  statusCode?: number
  stdout?: string
  stderr?: string
  children?: ParsedLine[]
  [key: string]: any
}

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

    if (line.type === 'command' && line.content) {
      const result = executeCommand(line.content)
      newLine.statusCode = result.statusCode
      newLine.stdout = result.stdout
      newLine.stderr = result.stderr
    }

    if (line.children && Array.isArray(line.children)) {
      newLine.children = executeCommands(line.children)
    }

    return newLine
  })
}
