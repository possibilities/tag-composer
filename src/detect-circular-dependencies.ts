import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { parseContent } from './parse-content.js'
import { parseCommands } from './parse-commands.js'
import { isCommandLine } from './types.js'

export function detectCircularDependencies(
  filePath: string,
  callingCommandName: string = 'tag-composer',
): void {
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
      const commands = parseCommands(parsed, callingCommandName)

      for (const line of commands) {
        if (
          isCommandLine(line) &&
          line.commandName === callingCommandName &&
          line.ast
        ) {
          const command = line.ast.commands?.[0]
          if (command && command.suffix && Array.isArray(command.suffix)) {
            const firstArg = command.suffix[0]
            if (
              firstArg &&
              typeof firstArg === 'object' &&
              'text' in firstArg
            ) {
              const targetFile = firstArg.text
              if (typeof targetFile === 'string') {
                const resolvedTarget = resolve(
                  dirname(absolutePath),
                  targetFile,
                )
                checkFile(resolvedTarget)
              }
            }
          }
        }
      }
    } finally {
      currentPath.pop()
    }
  }

  checkFile(filePath)
}
