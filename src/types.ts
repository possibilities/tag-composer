export interface ParseResult {
  type: 'Script'
  commands: ASTNode[]
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ParsedCommand {
  type: 'command'
  commandName: string
  input: string
  stdout: string
  stderr: string
  exitCode: number
  hiddenStdout?: boolean
  extraChildren?: ParsedNode[]
  fs2xmlNonShebang?: boolean
}

export interface ParsedOperator {
  type: 'logical-and-operator' | 'logical-or-operator' | 'pipe-operator'
}

export interface ParsedWrapper {
  type: 'wrapper'
  tag: string
  children: ParsedNode[]
}

export interface ParsedContent {
  type: 'content'
  lines: string[]
}

export interface ParsedDirectory {
  type: 'directory'
  name: string
  children: ParsedNode[]
}

export interface ParsedEmptyTag {
  type: 'empty-tag'
  tag: string
}

export type ParsedNode =
  | ParsedCommand
  | ParsedOperator
  | ParsedWrapper
  | ParsedContent
  | ParsedDirectory
  | ParsedEmptyTag

export interface ParsedFsInfo {
  nodes: ParsedNode[]
}

export interface ASTNode {
  type: string
  commands?: ASTNode[]
  left?: ASTNode
  right?: ASTNode
  op?: 'and' | 'or'
  name?: { text?: string }
  suffix?: Array<{ text?: string }>
}

export interface Options {
  flatten?: boolean
}
