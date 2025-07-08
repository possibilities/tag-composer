import { MarkdownReference, ParsedLine, XmlElement } from './types.js'

function parseMarkdownReference(
  line: string,
  lineNumber: number,
): MarkdownReference {
  const path = line.substring(2).trim()

  if (path.length === 0) {
    throw new Error(
      `Parse error at line ${lineNumber}: Markdown reference path cannot be empty`,
    )
  }

  if (!path.endsWith('.md')) {
    throw new Error(
      `Parse error at line ${lineNumber}: Markdown reference must end with .md`,
    )
  }

  return {
    type: 'markdown-reference',
    path,
  }
}

export function parseContent(
  input: string,
): (ParsedLine | MarkdownReference)[] {
  return input
    .split('\n')
    .filter(line => line.length > 0)
    .map((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith('@@')) {
        return parseMarkdownReference(trimmedLine, index + 1)
      }
      return {
        type: 'element',
        name: 'text',
        elements: [{ type: 'text', text: line }],
      } as XmlElement
    })
}
