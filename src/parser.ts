interface ParsedLine {
  type: 'text' | 'command'
  content: string
}

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
        return {
          type: 'command',
          content: line.substring(2),
        }
      }
      return {
        type: 'text',
        content: line,
      }
    })
}
