import bashParse from 'bash-parser'
import { CommandLine, ParsedLine } from './types.js'

function parseCommandLine(
  line: string,
  lineNumber: number,
  callingCommandName?: string,
): CommandLine {
  const commandInput = line.substring(2)
  const content = commandInput.trim()

  if (content.length === 0) {
    throw new Error(
      `Parse error at line ${lineNumber}: Command cannot be empty`,
    )
  }

  let ast
  try {
    ast = bashParse(commandInput)
  } catch (error) {
    throw new Error(
      `Parse error at line ${lineNumber}: Invalid bash syntax - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  const firstCommand = ast?.commands?.[0]
  const commandName =
    firstCommand?.type === 'Command'
      ? firstCommand.name?.text
      : firstCommand?.type || 'unknown'

  return {
    type: { name: 'command', attrs: { name: commandName } },
    input: commandInput,
    commandName,
    isCallingCommand: callingCommandName === commandName,
    ast,
  } as CommandLine
}

export function parseContent(
  input: string,
  callingCommandName?: string,
): ParsedLine[] {
  return input
    .split('\n')
    .filter(line => line.length > 0)
    .map((line, index) => {
      if (line.startsWith('!!')) {
        return parseCommandLine(line, index + 1, callingCommandName)
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
