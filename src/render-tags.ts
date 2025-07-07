import {
  TagWithAttributes,
  getTypeName,
  ParsedLine,
  RenderOptions,
} from './types.js'

function renderIndent(level: number, indent: string): string {
  return indent.repeat(level)
}

function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}='${value}'`)
    .join(' ')
}

function isTagWithAttributes(value: unknown): value is TagWithAttributes {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'attrs' in value
  )
}

function renderLine(line: ParsedLine, level: number, indent: string): string[] {
  const output: string[] = []
  const { type, children, ...rest } = line

  // Render opening tag with optional attributes
  const typeName = getTypeName(type)
  if (typeof type === 'object' && type.attrs) {
    output.push(
      `${renderIndent(level, indent)}<${typeName} ${renderAttrs(type.attrs)}>`,
    )
  } else {
    output.push(`${renderIndent(level, indent)}<${typeName}>`)
  }

  // Render properties
  for (const [key, value] of Object.entries(rest)) {
    // Skip internal properties
    if (key === 'ast' || key === 'isCallingCommand' || key === 'commandName') {
      continue
    }

    if (isTagWithAttributes(value)) {
      // Self-closing tag with attributes
      output.push(
        `${renderIndent(level + 1, indent)}<${value.name} ${renderAttrs(value.attrs)} />`,
      )
    } else if (value === '' || value == null) {
      // Self-closing tag
      output.push(`${renderIndent(level + 1, indent)}<${key} />`)
    } else {
      // Normal tag with content
      output.push(
        `${renderIndent(level + 1, indent)}<${key}>${value.toString().trimEnd()}</${key}>`,
      )
    }
  }

  // Render children
  if (children && Array.isArray(children)) {
    for (const child of children) {
      output.push(...renderLine(child, level + 1, indent))
    }
  }

  // Render closing tag
  output.push(`${renderIndent(level, indent)}</${typeName}>`)

  return output
}

export function renderTags(
  lines: ParsedLine[],
  options: RenderOptions = {},
): string {
  const indent = options.indent ?? '  '
  const output: string[] = []

  output.push('<document>')

  for (const line of lines) {
    output.push(...renderLine(line, 1, indent))
  }

  output.push('</document>')

  return output.join('\n')
}
