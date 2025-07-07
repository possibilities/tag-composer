import { spawnSync } from 'child_process'
import { TagWithAttributes, TypeValue, getTypeName } from './types.js'

export interface ExecutionResult {
  statusCode: number
  stdout: string
  stderr: string
}

interface ParsedLine {
  type: TypeValue
  input?: string
  commandName?: string
  exit?: TagWithAttributes
  stdout?: string
  stderr?: string
  children?: ParsedLine[]
  content?: string
  ast?: unknown
  isCallingCommand?: boolean
  [key: string]:
    | string
    | number
    | boolean
    | TypeValue
    | TagWithAttributes
    | ParsedLine[]
    | undefined
    | unknown
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

    if (getTypeName(line.type) === 'command' && line.input) {
      const result = executeCommand(line.input)
      newLine.exit = {
        name: 'exit',
        attrs: {
          status: result.statusCode === 0 ? 'success' : 'failure',
          code: result.statusCode.toString(),
        },
      }
      newLine.stdout = result.stdout
      newLine.stderr = result.stderr
    }

    if (line.children && Array.isArray(line.children)) {
      newLine.children = executeCommands(line.children)
    }

    return newLine
  })
}
