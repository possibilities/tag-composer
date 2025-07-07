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

export function executeCommands(
  lines: ParsedLine[],
  callingCommandName?: string,
): ParsedLine[] {
  return lines.flatMap(line => {
    const newLine = { ...line }

    if (
      isCommandLine(line) &&
      getTypeName(line.type) === 'command' &&
      line.input
    ) {
      if (line.commandName === callingCommandName && line.ast) {
        const command = line.ast.commands?.[0]
        if (command && command.suffix) {
          const hasJsonFlag = command.suffix.some(
            s => typeof s === 'object' && 'text' in s && s.text === '--json',
          )

          if (hasJsonFlag) {
            throw new Error(
              `Error: Cannot execute '${line.commandName}' with --json flag. ` +
                `This would cause infinite recursion.`,
            )
          }

          const cliPath = new URL('../dist/cli.js', import.meta.url).pathname
          const commandWithJson = `node ${cliPath} --json --no-recursion-check ${command.suffix
            .map(s => (typeof s === 'object' && 'text' in s ? s.text : ''))
            .filter(Boolean)
            .join(' ')}`

          const result = executeCommand(commandWithJson)

          if (result.statusCode !== 0) {
            throw new Error(
              result.stderr ||
                result.stdout ||
                `Failed to execute ${line.commandName}`,
            )
          }

          try {
            const parsedJson: ParsedLine[] = JSON.parse(result.stdout)
            return parsedJson
          } catch (error) {
            throw new Error(
              `Failed to parse output from ${line.commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
          }
        }
      }

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
      newLine.children = executeCommands(line.children, callingCommandName)
    }

    return newLine
  })
}
