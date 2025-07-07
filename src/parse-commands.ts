import bashParse from 'bash-parser'
import {
  AstNode,
  ParsedLine,
  isUnparsedCommandLine,
  CommandLine,
  UnparsedCommandLine,
} from './types.js'
import { createCliCommand } from './create-cli-command.js'

export function parseCommand(
  unparsedCommand: UnparsedCommandLine,
  callingCommandName?: string,
): CommandLine {
  let ast: AstNode
  try {
    ast = bashParse(unparsedCommand.input)
  } catch (error) {
    throw new Error(
      `Invalid bash syntax - ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!ast || typeof ast !== 'object') {
    throw new Error('Invalid AST')
  }

  if (ast.type !== 'Script') {
    throw new Error('Root node must be Script')
  }

  if (!ast.commands || !Array.isArray(ast.commands)) {
    throw new Error('Script must have commands array')
  }

  if (ast.commands.length !== 1) {
    throw new Error('Only single commands are allowed')
  }

  const command = ast.commands[0]

  if (command.type !== 'Command') {
    throw new Error(`Only simple commands are allowed`)
  }

  if (command.async) {
    throw new Error('Background jobs are not allowed')
  }

  if (command.prefix) {
    for (const prefixItem of command.prefix) {
      if (prefixItem.type === 'Redirect') {
        throw new Error('Redirections are not allowed')
      }
    }
  }

  if (command.suffix) {
    for (const suffixItem of command.suffix) {
      if (suffixItem.type === 'Redirect') {
        throw new Error('Redirections are not allowed')
      }

      if (
        suffixItem.type === 'dless' ||
        suffixItem.type === 'dlessdash' ||
        suffixItem.type === 'tless'
      ) {
        throw new Error('Redirections are not allowed')
      }

      if (suffixItem.expansion && Array.isArray(suffixItem.expansion)) {
        for (const exp of suffixItem.expansion) {
          if (exp.type === 'CommandExpansion') {
            throw new Error('Command substitution is not allowed')
          }
        }
      }

      if (suffixItem.type === 'Word' && typeof suffixItem.text === 'string') {
        if (suffixItem.text.includes('$(') || suffixItem.text.includes('`')) {
          throw new Error('Command substitution is not allowed')
        }
      }
    }
  }

  const commandName = command.name?.text || 'unknown'
  const isCallingCommand = callingCommandName === commandName

  if (isCallingCommand) {
    try {
      const program = createCliCommand()

      const args: string[] = []
      if (command.name?.text) {
        args.push(command.name.text)
      }
      if (command.suffix) {
        for (const suffixItem of command.suffix) {
          if (
            suffixItem.type === 'Word' &&
            typeof suffixItem.text === 'string'
          ) {
            args.push(suffixItem.text)
          }
        }
      }

      const argv = ['node', ...args]

      program.exitOverride()
      program.parse(argv)
    } catch (error) {
      throw new Error(
        `Invalid calling command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  return {
    type: { name: 'command', attrs: { name: commandName } },
    input: unparsedCommand.input,
    commandName,
    children: unparsedCommand.children,
  }
}

export function parseCommands(
  lines: ParsedLine[],
  callingCommandName?: string,
): ParsedLine[] {
  return lines.map(line => {
    if (isUnparsedCommandLine(line)) {
      try {
        return parseCommand(line, callingCommandName)
      } catch (error) {
        throw new Error(
          `Error parsing command "${line.input}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    if (line.children && Array.isArray(line.children)) {
      return {
        ...line,
        children: parseCommands(line.children, callingCommandName),
      }
    }

    return line
  })
}
