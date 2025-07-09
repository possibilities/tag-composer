import { describe, it, expect } from 'vitest'
import { applyTagCaseTransformation } from '../src/transformations'
import { ParsedLine, XmlElement } from '../src/types'

describe('applyTagCaseTransformation', () => {
  it('should return elements unchanged when tagCase is kebab', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'my-tag' },
      { type: 'element', name: 'another-tag' },
    ]

    const result = applyTagCaseTransformation(input, 'kebab')
    expect(result).toEqual(input)
  })

  it('should transform kebab-case to PascalCase', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'my-tag' },
      { type: 'element', name: 'another-tag-name' },
      { type: 'element', name: 'simple' },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')

    expect((result[0] as XmlElement).name).toBe('MyTag')
    expect((result[1] as XmlElement).name).toBe('AnotherTagName')
    expect((result[2] as XmlElement).name).toBe('Simple')
  })

  it('should handle already PascalCase names', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'MyTag' },
      { type: 'element', name: 'AnotherTag' },
      { type: 'element', name: 'XMLParser' },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')

    expect((result[0] as XmlElement).name).toBe('MyTag')
    expect((result[1] as XmlElement).name).toBe('AnotherTag')
    expect((result[2] as XmlElement).name).toBe('XMLParser')
  })

  it('should transform nested elements recursively', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'parent-tag',
        elements: [
          { type: 'element', name: 'child-one' },
          {
            type: 'element',
            name: 'child-two',
            elements: [{ type: 'element', name: 'grand-child' }],
          },
        ],
      },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')
    const parent = result[0] as XmlElement

    expect(parent.name).toBe('ParentTag')
    expect((parent.elements![0] as XmlElement).name).toBe('ChildOne')
    expect((parent.elements![1] as XmlElement).name).toBe('ChildTwo')
    expect(
      ((parent.elements![1] as XmlElement).elements![0] as XmlElement).name,
    ).toBe('GrandChild')
  })

  it('should preserve text nodes', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'my-tag',
        elements: [{ type: 'text', text: 'Some content' }],
      },
      { type: 'text', text: 'Root level text' },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')
    const element = result[0] as XmlElement

    expect(element.name).toBe('MyTag')
    expect(element.elements![0]).toEqual({ type: 'text', text: 'Some content' })
    expect(result[1]).toEqual({ type: 'text', text: 'Root level text' })
  })

  it('should handle single word tags', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'tag' },
      { type: 'element', name: 'a' },
      { type: 'element', name: 'test' },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')

    expect((result[0] as XmlElement).name).toBe('Tag')
    expect((result[1] as XmlElement).name).toBe('A')
    expect((result[2] as XmlElement).name).toBe('Test')
  })

  it('should handle tags with numbers', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'tag-1' },
      { type: 'element', name: 'test-2-tag' },
      { type: 'element', name: 'h1' },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')

    expect((result[0] as XmlElement).name).toBe('Tag1')
    expect((result[1] as XmlElement).name).toBe('Test2Tag')
    expect((result[2] as XmlElement).name).toBe('H1')
  })

  it('should transform root tag name', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'document',
        elements: [{ type: 'element', name: 'sub-element' }],
      },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')
    const root = result[0] as XmlElement

    expect(root.name).toBe('Document')
    expect((root.elements![0] as XmlElement).name).toBe('SubElement')
  })

  it('should preserve attributes', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'my-tag',
        attributes: { id: '123', class: 'test-class' },
      },
    ]

    const result = applyTagCaseTransformation(input, 'pascal')
    const element = result[0] as XmlElement

    expect(element.name).toBe('MyTag')
    expect(element.attributes).toEqual({ id: '123', class: 'test-class' })
  })
})
