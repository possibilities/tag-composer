import { spawnSync } from 'child_process'
import { dirname, normalize, relative, resolve } from 'path'
import {
  ParsedLine,
  ExecutionResult,
  CommandLine,
  isCommandLine,
  XmlElement,
  XmlNode,
} from './types.js'

function resolvePath(
  pathArg: string,
  currentFile: string | undefined,
  resolveRelativeToCwd: boolean,
): string {
  if (pathArg.startsWith('/')) {
    return pathArg
  } else {
    if (resolveRelativeToCwd || !currentFile) {
      return resolve(process.cwd(), pathArg)
    } else {
      return resolve(dirname(currentFile), pathArg)
    }
  }
}

function extractDirectorySegments(filePath: string): string[] {
  const normalizedPath = normalize(filePath)
  const directoryPath = dirname(normalizedPath)

  if (directoryPath === '.' || directoryPath === '') {
    return []
  }

  const segments = directoryPath.split('/')
  const filteredSegments = segments.filter(segment => {
    return segment !== '' && segment !== '.' && !/^\.+$/.test(segment)
  })

  return filteredSegments
}

function wrapInNestedTags(
  segments: string[],
  content: ParsedLine[],
): ParsedLine[] {
  if (segments.length === 0) {
    return content
  }

  const innerSegment = segments[segments.length - 1]
  const outerSegments = segments.slice(0, -1)

  const wrappedElement: XmlElement = {
    type: 'element',
    name: innerSegment,
    elements: content,
  }

  return wrapInNestedTags(outerSegments, [wrappedElement])
}

function executeCommand(command: string): ExecutionResult {
  const result = spawnSync('sh', ['-c', command], {
    encoding: 'utf8',
    shell: false,
  })

  return {
    statusCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

function executeTagComposerCommand(
  line: CommandLine,
  _callingCommandName: string,
  currentFilePath?: string,
  _resolveRelativeToCwd?: boolean,
): ParsedLine[] {
  const command = line.ast?.commands?.[0]
  if (!command || !command.suffix) {
    throw new Error('Invalid tag-composer command structure')
  }

  const hasJsonFlag = command.suffix.some(
    s => typeof s === 'object' && 'text' in s && s.text === '--json',
  )

  if (hasJsonFlag) {
    throw new Error(
      `Error: Cannot execute '${line.commandName}' with --json flag. ` +
        `This would cause infinite recursion.`,
    )
  }

  const suffixTexts = command.suffix
    .map(s => {
      if (typeof s === 'object' && 'text' in s && typeof s.text === 'string') {
        return s.text
      } else if (typeof s === 'string') {
        return s
      }
      return ''
    })
    .filter(Boolean)

  const filePath = suffixTexts.find(text => text.endsWith('.md'))

  if (!filePath) {
    throw new Error('No markdown file specified in tag-composer command')
  }

  const resolvedFilePath = resolvePath(filePath, currentFilePath, false)

  const otherArgs = suffixTexts.filter(text => text !== filePath)

  const cliPath = new URL('../dist/cli.js', import.meta.url).pathname
  const commandWithJson = `node ${cliPath} --json --no-recursion-check --no-resolve-markdown-relative-to-cwd ${otherArgs.join(' ')} "${resolvedFilePath}"`

  const result = executeCommand(commandWithJson)

  if (result.statusCode !== 0) {
    throw new Error(
      result.stderr || result.stdout || `Failed to execute ${line.commandName}`,
    )
  }

  try {
    const parsedJson: ParsedLine[] = JSON.parse(result.stdout)

    const cwd = process.cwd()

    let directorySegments: string[] = []

    if (resolvedFilePath.startsWith(cwd)) {
      const relativeToCwd = relative(cwd, resolvedFilePath)
      directorySegments = extractDirectorySegments(relativeToCwd)
    } else if (!filePath.startsWith('/')) {
      const normalizedPath = normalize(filePath)
      directorySegments = extractDirectorySegments(normalizedPath)
    } else {
      directorySegments = []
    }

    return wrapInNestedTags(directorySegments, parsedJson)
  } catch (error) {
    throw new Error(
      `Failed to parse output from ${line.commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

function createTextElement(name: string, text: string): XmlElement {
  if (!text) {
    return {
      type: 'element',
      name: name,
    }
  }
  const trimmedText =
    (name === 'stdout' || name === 'stderr') && text.endsWith('\n')
      ? text.slice(0, -1)
      : text

  return {
    type: 'element',
    name: name,
    elements: [{ type: 'text', text: trimmedText }],
  }
}

function findInputElement(elements: XmlNode[] | undefined): string | undefined {
  if (!elements) return undefined

  for (const element of elements) {
    if (element.type === 'element' && element.name === 'input') {
      const textNode = element.elements?.find(e => e.type === 'text')
      if (textNode && textNode.type === 'text') {
        return textNode.text
      }
    }
  }
  return undefined
}

export function executeCommands(
  lines: ParsedLine[],
  callingCommandName?: string,
  currentFilePath?: string,
  resolveRelativeToCwd?: boolean,
): ParsedLine[] {
  return lines.flatMap(line => {
    if (isCommandLine(line)) {
      const input = findInputElement(line.elements)
      if (input && line.commandName === callingCommandName && line.ast) {
        return executeTagComposerCommand(
          line,
          callingCommandName,
          currentFilePath,
          resolveRelativeToCwd,
        )
      }

      if (input) {
        const result = executeCommand(input)

        const newElements: XmlNode[] = [
          createTextElement('input', input),
          {
            type: 'element',
            name: 'exit',
            attributes: {
              status: result.statusCode === 0 ? 'success' : 'failure',
              code: result.statusCode.toString(),
            },
          },
          createTextElement('stdout', result.stdout),
          createTextElement('stderr', result.stderr),
        ]

        if (line.elements) {
          for (const elem of line.elements) {
            if (
              elem.type === 'element' &&
              !['input', 'exit', 'stdout', 'stderr'].includes(elem.name)
            ) {
              newElements.push(elem)
            }
          }
        }

        return {
          ...line,
          elements: newElements,
        }
      }
    }

    if (line.elements) {
      const processedElements = line.elements.map(elem => {
        if (elem.type === 'element' && elem.elements) {
          const processed = executeCommands(
            [elem],
            callingCommandName,
            currentFilePath,
            resolveRelativeToCwd,
          )[0]
          return processed
        }
        return elem
      })

      return {
        ...line,
        elements: processedElements,
      }
    }

    return line
  })
}
