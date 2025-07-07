export interface XmlElement {
  type: 'element'
  name: string
  attributes?: Record<string, string>
  elements?: XmlNode[]
}

export interface XmlText {
  type: 'text'
  text: string
}

export interface XmlComment {
  type: 'comment'
  comment: string
}

export interface XmlCdata {
  type: 'cdata'
  cdata: string
}

export type XmlNode = XmlElement | XmlText | XmlComment | XmlCdata

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
  children?: XmlElement[]
}

export interface CommandLine extends XmlElement {
  name: 'command'
  attributes: { name: string }
  elements: XmlNode[]
  commandName: string
  ast?: AstNode
}

export interface TextLine extends XmlElement {
  name: 'text'
  elements: XmlElement[]
}

export type ParsedLine = XmlElement

export interface ExecutionResult {
  statusCode: number
  stdout: string
  stderr: string
}

export interface RenderOptions {
  indent?: string
}

export function isCommandLine(line: ParsedLine): line is CommandLine {
  return line.type === 'element' && line.name === 'command'
}

export function isUnparsedCommandLine(
  line: ParsedLine | UnparsedCommandLine,
): line is UnparsedCommandLine {
  return 'type' in line && line.type === 'command' && !('name' in line)
}
