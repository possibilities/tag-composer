interface ParsedLine {
  type: string
  [key: string]: any
}

interface RenderOptions {
  indent?: string
}

function renderIndent(level: number, indent: string): string {
  return indent.repeat(level)
}

export function renderToTags(
  lines: ParsedLine[],
  options: RenderOptions = {},
): string {
  const indent = options.indent ?? '  '
  const output: string[] = []

  output.push('<document>')

  for (const line of lines) {
    const { type, ...rest } = line

    output.push(`${renderIndent(1, indent)}<${type}>`)

    for (const [key, value] of Object.entries(rest)) {
      if (value === '') {
        output.push(`${renderIndent(2, indent)}<${key} />`)
      } else {
        output.push(
          `${renderIndent(2, indent)}<${key}>${value.toString().trimEnd()}</${key}>`,
        )
      }
    }

    output.push(`${renderIndent(1, indent)}</${type}>`)
  }

  output.push('</document>')

  return output.join('\n')
}
