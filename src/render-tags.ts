import * as convert from 'xml-js'
import { ParsedLine, RenderOptions } from './types.js'

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
    spaces: options.indent || 2,
    indentText: false,
    indentCdata: false,
    indentAttributes: false,
    ignoreText: false,
    noValidation: true,
    fullTagEmptyElement: false,
  }

  return convert.js2xml(document, xmlOptions)
}
