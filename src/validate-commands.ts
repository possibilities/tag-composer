import { TypeValue, getTypeName } from './types.js'

interface AstNode {
  type: string
  commands?: AstNode[]
  name?: { text: string }
  prefix?: AstNode[]
  suffix?: AstNode[]
  [key: string]: string | AstNode | AstNode[] | { text: string } | undefined
}

interface ParsedLine {
  type: TypeValue
  ast?: AstNode
  children?: ParsedLine[]
  [key: string]:
    | string
    | number
    | boolean
    | TypeValue
    | AstNode
    | ParsedLine[]
    | undefined
}

export function validateCommand(ast: AstNode): void {
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
    throw new Error(`Only simple commands are allowed, found ${command.type}`)
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
    }
  }
}

export function validateCommands(lines: ParsedLine[]): ParsedLine[] {
  for (const line of lines) {
    if (getTypeName(line.type) === 'command' && line.ast) {
      validateCommand(line.ast)
    }

    if (line.children && Array.isArray(line.children)) {
      validateCommands(line.children)
    }
  }

  return lines
}
