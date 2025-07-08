import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { parseContent } from './parse-content.js'

interface MarkdownReference {
  type: 'markdown-reference'
  path: string
}

function isMarkdownReference(item: any): item is MarkdownReference {
  return item && item.type === 'markdown-reference'
}

export function detectCircularDependencies(filePath: string): void {
  const visitedFiles = new Set<string>()
  const currentPath: string[] = []

  function checkFile(file: string): void {
    const absolutePath = resolve(file)

    if (currentPath.includes(absolutePath)) {
      const cycleStart = currentPath.indexOf(absolutePath)
      const cycle = [...currentPath.slice(cycleStart), absolutePath]
      throw new Error(
        `Error: Circular dependency detected:\n` +
          cycle
            .map(
              (f, i) =>
                `  ${i === 0 ? '┌>' : i === cycle.length - 1 ? '└>' : '├─'} ${f}`,
            )
            .join('\n'),
      )
    }

    if (visitedFiles.has(absolutePath)) {
      return
    }

    if (!existsSync(absolutePath)) {
      return
    }

    visitedFiles.add(absolutePath)
    currentPath.push(absolutePath)

    try {
      const content = readFileSync(absolutePath, 'utf-8')
      const parsed = parseContent(content)

      for (const item of parsed) {
        if (isMarkdownReference(item)) {
          const resolvedTarget = resolve(dirname(absolutePath), item.path)
          checkFile(resolvedTarget)
        }
      }
    } finally {
      currentPath.pop()
    }
  }

  checkFile(filePath)
}
