import { describe, it, expect } from 'vitest'
import { transformTagCase } from '../src/transformations'
import { ParsedLine, XmlElement } from '../src/types'

describe('transformTagCase', () => {
  it('should return elements unchanged when case style is pascal', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'MyTagName' },
      { type: 'element', name: 'AnotherTag' },
    ]

    const result = transformTagCase(input, 'pascal')
    expect(result).toEqual(input)
  })

  it('should convert tags to kebab-case', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'MyTagName' },
      { type: 'element', name: 'AnotherLongTagName' },
      { type: 'element', name: 'SimpleTag' },
    ]

    const result = transformTagCase(input, 'kebab')

    expect((result[0] as XmlElement).name).toBe('my-tag-name')
    expect((result[1] as XmlElement).name).toBe('another-long-tag-name')
    expect((result[2] as XmlElement).name).toBe('simple-tag')
  })

  it('should convert tags to SHOUT case', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'MyTagName' },
      { type: 'element', name: 'anotherTag' },
      { type: 'element', name: 'ALREADY_CAPS' },
    ]

    const result = transformTagCase(input, 'shout')

    expect((result[0] as XmlElement).name).toBe('MYTAGNAME')
    expect((result[1] as XmlElement).name).toBe('ANOTHERTAG')
    expect((result[2] as XmlElement).name).toBe('ALREADY_CAPS')
  })

  it('should convert tags to meme case', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'MyTag' },
      { type: 'element', name: 'Test' },
      { type: 'element', name: 'LongerTagName' },
    ]

    const result = transformTagCase(input, 'meme')

    expect((result[0] as XmlElement).name).toBe('mYtAg')
    expect((result[1] as XmlElement).name).toBe('tEsT')
    expect((result[2] as XmlElement).name).toBe('lOnGeRtAgNaMe')
  })

  it('should transform tags recursively at all levels', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'ParentTag',
        elements: [
          { type: 'element', name: 'ChildTag' },
          {
            type: 'element',
            name: 'NestedParent',
            elements: [{ type: 'element', name: 'DeepChild' }],
          },
        ],
      },
    ]

    const result = transformTagCase(input, 'kebab')

    const parent = result[0] as XmlElement
    expect(parent.name).toBe('parent-tag')
    expect((parent.elements![0] as XmlElement).name).toBe('child-tag')

    const nested = parent.elements![1] as XmlElement
    expect(nested.name).toBe('nested-parent')
    expect((nested.elements![0] as XmlElement).name).toBe('deep-child')
  })

  it('should preserve text nodes', () => {
    const input: ParsedLine[] = [
      { type: 'text', text: 'Some text content' },
      { type: 'element', name: 'MyTag' },
      { type: 'text', text: 'More text' },
    ]

    const result = transformTagCase(input, 'kebab')

    expect(result[0]).toEqual({ type: 'text', text: 'Some text content' })
    expect((result[1] as XmlElement).name).toBe('my-tag')
    expect(result[2]).toEqual({ type: 'text', text: 'More text' })
  })

  it('should preserve element attributes', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'MyComponent',
        attributes: { id: 'comp-1', class: 'primary' },
      },
    ]

    const result = transformTagCase(input, 'kebab')

    const element = result[0] as XmlElement
    expect(element.name).toBe('my-component')
    expect(element.attributes).toEqual({ id: 'comp-1', class: 'primary' })
  })

  it('should handle single word tags', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'Tag' },
      { type: 'element', name: 'div' },
      { type: 'element', name: 'SPAN' },
    ]

    const kebabResult = transformTagCase(input, 'kebab')
    expect((kebabResult[0] as XmlElement).name).toBe('tag')
    expect((kebabResult[1] as XmlElement).name).toBe('div')
    expect((kebabResult[2] as XmlElement).name).toBe('span')

    const shoutResult = transformTagCase(input, 'shout')
    expect((shoutResult[0] as XmlElement).name).toBe('TAG')
    expect((shoutResult[1] as XmlElement).name).toBe('DIV')
    expect((shoutResult[2] as XmlElement).name).toBe('SPAN')

    const memeResult = transformTagCase(input, 'meme')
    expect((memeResult[0] as XmlElement).name).toBe('tAg')
    expect((memeResult[1] as XmlElement).name).toBe('dIv')
    expect((memeResult[2] as XmlElement).name).toBe('sPaN')
  })

  it('should handle tags with acronyms', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'XMLParser' },
      { type: 'element', name: 'HTTPSConnection' },
      { type: 'element', name: 'APIKey' },
    ]

    const result = transformTagCase(input, 'kebab')

    expect((result[0] as XmlElement).name).toBe('xml-parser')
    expect((result[1] as XmlElement).name).toBe('https-connection')
    expect((result[2] as XmlElement).name).toBe('api-key')
  })

  it('should handle tags with existing separators', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'already-kebab-case' },
      { type: 'element', name: 'snake_case_tag' },
      { type: 'element', name: 'mixed-Style_Tag' },
    ]

    const kebabResult = transformTagCase(input, 'kebab')
    expect((kebabResult[0] as XmlElement).name).toBe('already-kebab-case')
    expect((kebabResult[1] as XmlElement).name).toBe('snake-case-tag')
    expect((kebabResult[2] as XmlElement).name).toBe('mixed-style-tag')

    const shoutResult = transformTagCase(input, 'shout')
    expect((shoutResult[0] as XmlElement).name).toBe('ALREADY-KEBAB-CASE')
    expect((shoutResult[1] as XmlElement).name).toBe('SNAKE_CASE_TAG')
    expect((shoutResult[2] as XmlElement).name).toBe('MIXED-STYLE_TAG')
  })

  it('should handle mixed content with nested elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'DocumentRoot',
        elements: [
          { type: 'text', text: 'Introduction text' },
          { type: 'element', name: 'FirstSection' },
          { type: 'text', text: 'Middle content' },
          {
            type: 'element',
            name: 'SecondSection',
            elements: [
              { type: 'element', name: 'SubSection' },
              { type: 'text', text: 'Nested text' },
            ],
          },
        ],
      },
    ]

    const result = transformTagCase(input, 'kebab')

    const root = result[0] as XmlElement
    expect(root.name).toBe('document-root')
    expect(root.elements![0]).toEqual({
      type: 'text',
      text: 'Introduction text',
    })
    expect((root.elements![1] as XmlElement).name).toBe('first-section')
    expect(root.elements![2]).toEqual({ type: 'text', text: 'Middle content' })

    const second = root.elements![3] as XmlElement
    expect(second.name).toBe('second-section')
    expect((second.elements![0] as XmlElement).name).toBe('sub-section')
    expect(second.elements![1]).toEqual({ type: 'text', text: 'Nested text' })
  })
})
