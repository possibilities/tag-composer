import bashParse from 'bash-parser'

interface AstNode {
  type: string
  [key: string]: any
}

interface TextLine {
  type: 'text'
  content: string
  children?: ParsedLine[]
}

interface CommandLine {
  type: 'command'
  content: string
  commandName: string
  ast?: AstNode
  statusCode?: number
  stdout?: string
  stderr?: string
  children?: ParsedLine[]
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

        const firstCommand = ast?.commands?.[0]
        const commandName =
          firstCommand?.type === 'Command'
            ? firstCommand.name?.text
            : firstCommand?.type || 'unknown'

        const commandLine: CommandLine = {
          type: 'command',
          content: line.substring(2),
          commandName,
          ast,
        }

        return commandLine
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
