import * as convert from 'xml-js'
import { ParsedLine } from './types.js'

export function renderTags(elements: ParsedLine[], indent: number = 2): string {
  const xmlOptions = {
    compact: false,
    spaces: indent === 0 ? 1 : indent,
    indentText: true,
    indentCdata: false,
    indentAttributes: false,
    ignoreText: false,
    noValidation: true,
    fullTagEmptyElement: false,
  }

  const document = {
    elements: elements,
  }

  return convert.js2xml(document, xmlOptions)
}
