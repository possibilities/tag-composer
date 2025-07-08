import { UnparsedCommandLine, ParsedLine, XmlElement } from './types.js'

function parseCommandLine(
  line: string,
  lineNumber: number,
): UnparsedCommandLine {
  const commandInput = line.substring(2)
  const content = commandInput.trim()

  if (content.length === 0) {
    throw new Error(
      `Parse error at line ${lineNumber}: Command cannot be empty`,
    )
  }

  return {
    type: 'command',
    input: commandInput,
  }
}

export function parseContent(
  input: string,
): (ParsedLine | UnparsedCommandLine)[] {
  return input
    .split('\n')
    .filter(line => line.length > 0)
    .map((line, index) => {
      if (line.startsWith('!!')) {
        return parseCommandLine(line, index + 1)
      }
      return {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: line }],
      } as XmlElement
    })
}
