import bashParse from 'bash-parser'
import { validateCommand } from './validate-command.js'
import { executeCommand } from './execute-command.js'

interface TextLine {
  type: 'text'
  content: string
}

interface CommandLine {
  type: 'command'
  content: string
  ast: any
  statusCode: number
  stdout: string
  stderr: string
}

type ParsedLine = TextLine | CommandLine

export function parseContent(input: string): ParsedLine[] {
  return input
    .split('\n')
    .filter(line => line.length > 0)
    .map((line, index) => {
      if (line.startsWith('!!')) {
        const content = line.substring(2).trim()
        if (content.length === 0) {
          throw new Error(
            `Parse error at line ${index + 1}: Command cannot be empty`,
          )
        }

        let ast
        try {
          ast = bashParse(line.substring(2))
        } catch (error) {
          throw new Error(
            `Parse error at line ${index + 1}: Invalid bash syntax - ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }

        try {
          validateCommand(ast)
        } catch (error) {
          throw new Error(
            `Parse error at line ${index + 1}: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
          )
        }

        const result = executeCommand(line.substring(2))

        const commandLine: CommandLine = {
          type: 'command',
          content: line.substring(2),
          ast,
          statusCode: result.statusCode,
          stdout: result.stdout,
          stderr: result.stderr,
        }

        return commandLine
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
