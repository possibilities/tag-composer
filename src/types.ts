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

export interface MarkdownReference {
  type: 'markdown-reference'
  path: string
}

export interface TextLine extends XmlElement {
  name: 'text'
  elements: XmlElement[]
}

export type ParsedLine = XmlElement

export interface RenderOptions {
  indent?: string
}
