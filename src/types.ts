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

export type ParsedLine = XmlElement | XmlText

export interface RenderOptions {
  indent?: string
}
