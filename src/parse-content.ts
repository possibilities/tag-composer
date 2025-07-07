import bashParse from 'bash-parser'
import { CommandLine, ParsedLine } from './types.js'

export function parseContent(
  input: string,
  callingCommandName?: string,
): ParsedLine[] {
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

        const firstCommand = ast?.commands?.[0]
        const commandName =
          firstCommand?.type === 'Command'
            ? firstCommand.name?.text
            : firstCommand?.type || 'unknown'

        const commandLine: CommandLine = {
          type: { name: 'command', attrs: { name: commandName } },
          input: line.substring(2),
          commandName,
          isCallingCommand: callingCommandName === commandName,
          ast,
        } as CommandLine

        return commandLine
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
