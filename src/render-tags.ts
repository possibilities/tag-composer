interface ParsedLine {
  type: string
  children?: ParsedLine[]
  [key: string]: any
}

interface RenderOptions {
  indent?: string
}

function renderIndent(level: number, indent: string): string {
  return indent.repeat(level)
}

function renderLine(line: ParsedLine, level: number, indent: string): string[] {
  const output: string[] = []
  const { type, children, ...rest } = line

  output.push(`${renderIndent(level, indent)}<${type}>`)

  for (const [key, value] of Object.entries(rest)) {
    if (value === '') {
      output.push(`${renderIndent(level + 1, indent)}<${key} />`)
    } else {
      output.push(
        `${renderIndent(level + 1, indent)}<${key}>${value.toString().trimEnd()}</${key}>`,
      )
    }
  }

  if (children && Array.isArray(children)) {
    for (const child of children) {
      output.push(...renderLine(child, level + 1, indent))
    }
  }

  output.push(`${renderIndent(level, indent)}</${type}>`)

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
