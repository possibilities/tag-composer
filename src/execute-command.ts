import { spawnSync } from 'child_process'

export interface ExecutionResult {
  statusCode: number
  stdout: string
  stderr: string
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
