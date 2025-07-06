import type { ParsedFsInfo, ParsedNode, Options } from './types.js'

function flattenConsecutiveTags(lines: string[]): string[] {
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const currentLine = lines[i]
    const openTagMatch = currentLine.match(/^(\s*)<([^/>]+)>$/)

    if (openTagMatch) {
      const indent = openTagMatch[1]
      const tagName = openTagMatch[2]
      const collectedContent: string[] = []
      let j = i

      while (j < lines.length) {
        const checkLine = lines[j]
        const checkOpenMatch = checkLine.match(/^(\s*)<([^/>]+)>$/)

        if (
          checkOpenMatch &&
          checkOpenMatch[1] === indent &&
          checkOpenMatch[2] === tagName
        ) {
          j++
          const contentStartIndex = j

          while (
            j < lines.length &&
            !lines[j].match(new RegExp(`^${indent}</${tagName}>$`))
          ) {
            j++
          }

          if (j < lines.length) {
            for (let k = contentStartIndex; k < j; k++) {
              collectedContent.push(lines[k])
            }
            j++
          } else {
            break
          }
        } else {
          break
        }
      }

      if (collectedContent.length > 0) {
        result.push(`${indent}<${tagName}>`)
        collectedContent.forEach(line => result.push(line))
        result.push(`${indent}</${tagName}>`)
        i = j
      } else {
        result.push(currentLine)
        i++
      }
    } else {
      result.push(currentLine)
      i++
    }
  }

  return result
}

export function renderToXml(
  parsedInfo: ParsedFsInfo,
  options: Options,
): string {
  const lines: string[] = []
  const flatten = options.flatten !== false

  function renderNode(node: ParsedNode, indent: string = ''): void {
    if (node.type === 'command') {
      lines.push(`${indent}<${node.commandName}>`)
      lines.push(`${indent}  <input>${node.input}</input>`)

      if (!node.fs2xmlNonShebang) {
        if (!node.hiddenStdout) {
          if (node.stdout === '') {
            lines.push(`${indent}  <stdout />`)
          } else {
            lines.push(`${indent}  <stdout>${node.stdout}</stdout>`)
          }
        }

        if (node.stderr) {
          lines.push(`${indent}  <stderr>${node.stderr}</stderr>`)
        }
      }

      if (node.extraChildren) {
        for (const child of node.extraChildren) {
          renderNode(child, indent + '  ')
        }
      }

      if (!node.fs2xmlNonShebang) {
        if (node.exitCode === 0) {
          lines.push(`${indent}  <success code="0" />`)
        } else {
          lines.push(`${indent}  <failure code="${node.exitCode}" />`)
        }
      } else {
        if (node.stderr) {
          lines.push(`${indent}  <stderr>${node.stderr}</stderr>`)
        }

        if (node.exitCode === 0) {
          lines.push(`${indent}  <success code="0" />`)
        } else {
          lines.push(`${indent}  <failure code="${node.exitCode}" />`)
        }
      }

      lines.push(`${indent}</${node.commandName}>`)
    } else if (node.type === 'logical-and-operator') {
      lines.push(`${indent}<logical-and-operator />`)
    } else if (node.type === 'logical-or-operator') {
      lines.push(`${indent}<logical-or-operator />`)
    } else if (node.type === 'pipe-operator') {
      lines.push(`${indent}<pipe-operator />`)
    } else if (node.type === 'wrapper') {
      lines.push(`${indent}<${node.tag}>`)
      for (const child of node.children) {
        renderNode(child, indent + '  ')
      }
      lines.push(`${indent}</${node.tag}>`)
    } else if (node.type === 'directory') {
      lines.push(`${indent}<${node.name}>`)
      for (const child of node.children) {
        renderNode(child, indent + '  ')
      }
      lines.push(`${indent}</${node.name}>`)
    } else if (node.type === 'content') {
      for (const line of node.lines) {
        lines.push(`${indent}${line}`)
      }
    } else if (node.type === 'empty-tag') {
      lines.push(`${indent}<${node.tag} />`)
    }
  }

  for (const node of parsedInfo.nodes) {
    renderNode(node)
  }

  if (flatten) {
    return flattenConsecutiveTags(lines).join('\n')
  } else {
    return lines.join('\n')
  }
}
