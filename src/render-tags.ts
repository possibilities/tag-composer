import * as convert from 'xml-js'
import { ParsedLine, RenderOptions } from './types.js'

function removeIndentationFromTags(xml: string): string {
  const lines = xml.split('\n')
  let currentDepth = 0

  const processedLines = lines.map(line => {
    const trimmedLine = line.trimStart()

    if (trimmedLine.startsWith('</')) {
      currentDepth--
    }

    if (trimmedLine.startsWith('<') && trimmedLine.endsWith('>')) {
      const result = trimmedLine

      if (!trimmedLine.startsWith('</') && !trimmedLine.endsWith('/>')) {
        currentDepth++
      }

      return result
    }

    if (currentDepth > 0 && line.startsWith(' '.repeat(currentDepth))) {
      return line.substring(currentDepth)
    }

    return line
  })

  return processedLines.join('\n')
}

export function renderTags(
  elements: ParsedLine[],
  options: RenderOptions = {},
): string {
  const document = {
    elements: [
      {
        type: 'element' as const,
        name: 'document',
        elements: elements,
      },
    ],
  }

  const xmlOptions = {
    compact: false,
    spaces: options.indent === 0 ? 1 : (options.indent ?? 2),
    indentText: true,
    indentCdata: false,
    indentAttributes: false,
    ignoreText: false,
    noValidation: true,
    fullTagEmptyElement: false,
  }

  const xml = convert.js2xml(document, xmlOptions)

  if (options.indent === 0) {
    return removeIndentationFromTags(xml)
  }

  return xml
}
