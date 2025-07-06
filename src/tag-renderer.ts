interface TextLine {
  type: 'text'
  content: string
}

interface CommandLine {
  type: 'command'
  content: string
  ast: any
  statusCode: number
  stdout: string
  stderr: string
}

type ParsedLine = TextLine | CommandLine

interface RenderOptions {
  indent?: string
}

function extractCommandName(ast: any): string {
  if (ast?.commands?.[0]?.name?.text) {
    return ast.commands[0].name.text
  }
  return 'unknown'
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
    if (line.type === 'text') {
      output.push(`${renderIndent(1, indent)}<text>${line.content}</text>`)
    } else if (line.type === 'command') {
      const commandName = extractCommandName(line.ast)
      const exitCodeAttr =
        line.statusCode !== undefined ? ` exitCode="${line.statusCode}"` : ''

      output.push(
        `${renderIndent(1, indent)}<command name="${commandName}"${exitCodeAttr}>`,
      )
      output.push(
        `${renderIndent(2, indent)}<content>${line.content}</content>`,
      )

      if (line.stdout !== undefined && line.stdout !== '') {
        output.push(
          `${renderIndent(2, indent)}<stdout>${line.stdout.trimEnd()}</stdout>`,
        )
      } else {
        output.push(`${renderIndent(2, indent)}<stdout></stdout>`)
      }

      if (line.stderr !== undefined && line.stderr !== '') {
        output.push(
          `${renderIndent(2, indent)}<stderr>${line.stderr.trimEnd()}</stderr>`,
        )
      } else {
        output.push(`${renderIndent(2, indent)}<stderr></stderr>`)
      }

      output.push(`${renderIndent(1, indent)}</command>`)
    }
  }

  output.push('</document>')

  return output.join('\n')
}
