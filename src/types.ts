export interface TagWithAttributes {
  name: string
  attrs: Record<string, string>
}

export type TypeValue = string | TagWithAttributes

export function getTypeName(type: TypeValue): string {
  return typeof type === 'string' ? type : type.name
}

export interface AstNode {
  type: string
  commands?: AstNode[]
  name?: { text: string }
  prefix?: AstNode[]
  suffix?: AstNode[]
  [key: string]: string | AstNode | AstNode[] | { text: string } | undefined
}

export interface UnparsedCommandLine {
  type: 'command'
  input: string
  children?: ParsedLine[]
}

export interface CommandLine {
  type: TypeValue
  input: string
  commandName: string
  ast?: AstNode
  exit?: TagWithAttributes
  stdout?: string
  stderr?: string
  children?: ParsedLine[]
}

export interface TextLine {
  type: 'text'
  content: string
  children?: ParsedLine[]
}

export type ParsedLine = TextLine | UnparsedCommandLine | CommandLine

export interface ExecutionResult {
  statusCode: number
  stdout: string
  stderr: string
}

export interface RenderOptions {
  indent?: string
}

export function isCommandLine(line: ParsedLine): line is CommandLine {
  return typeof line.type === 'object' && line.type.name === 'command'
}

export function isUnparsedCommandLine(
  line: ParsedLine,
): line is UnparsedCommandLine {
  return line.type === 'command'
}
