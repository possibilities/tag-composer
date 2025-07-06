import parse from 'bash-parser'

interface TextLine {
  type: 'text'
  content: string
}

interface CommandLine {
  type: 'command'
  content: string
  ast: any
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
          // Parse the command (without the !! prefix)
          ast = parse(line.substring(2))
        } catch (error) {
          throw new Error(
            `Parse error at line ${index + 1}: Invalid bash syntax - ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }

        return {
          type: 'command',
          content: line.substring(2),
          ast,
        }
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
