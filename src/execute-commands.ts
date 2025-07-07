import { spawnSync } from 'child_process'
import {
  ParsedLine,
  ExecutionResult,
  CommandLine,
  isCommandLine,
  XmlElement,
  XmlNode,
} from './types.js'

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

  const cliPath = new URL('../dist/cli.js', import.meta.url).pathname
  const commandWithJson = `node ${cliPath} --json --no-recursion-check ${command.suffix
    .map(s => (typeof s === 'object' && 'text' in s ? s.text : ''))
    .filter(Boolean)
    .join(' ')}`

  const result = executeCommand(commandWithJson)

  if (result.statusCode !== 0) {
    throw new Error(
      result.stderr || result.stdout || `Failed to execute ${line.commandName}`,
    )
  }

  try {
    const parsedJson: ParsedLine[] = JSON.parse(result.stdout)
    return parsedJson
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
): ParsedLine[] {
  return lines.flatMap(line => {
    if (isCommandLine(line)) {
      const input = findInputElement(line.elements)
      if (input && line.commandName === callingCommandName && line.ast) {
        return executeTagComposerCommand(line, callingCommandName)
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
          const processed = executeCommands([elem], callingCommandName)[0]
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
