import { describe, it, expect } from 'vitest'
import { inlineCommonTags } from '../src/transformations'
import { ParsedLine, XmlElement } from '../src/types'

describe('inlineCommonTags', () => {
  it('should merge multiple tags with the same name', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'document',
        elements: [
          {
            type: 'element',
            name: 'rules',
            elements: [{ type: 'text', text: 'First rule' }],
          },
          {
            type: 'element',
            name: 'rules',
            elements: [{ type: 'text', text: 'Second rule' }],
          },
          {
            type: 'element',
            name: 'rules',
            elements: [{ type: 'text', text: 'Third rule' }],
          },
        ],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(1)
    const document = result[0] as XmlElement
    expect(document.elements).toHaveLength(1)

    const mergedRules = document.elements![0] as XmlElement
    expect(mergedRules.name).toBe('rules')
    expect(mergedRules.elements).toHaveLength(3)
    expect((mergedRules.elements![0] as any).text).toBe('First rule')
    expect((mergedRules.elements![1] as any).text).toBe('Second rule')
    expect((mergedRules.elements![2] as any).text).toBe('Third rule')
  })

  it('should preserve attributes from first occurrence', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'tag',
        attributes: { id: '1', class: 'first' },
        elements: [{ type: 'text', text: 'Content 1' }],
      },
      {
        type: 'element',
        name: 'tag',
        attributes: { id: '2' },
        elements: [{ type: 'text', text: 'Content 2' }],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(1)
    const merged = result[0] as XmlElement
    expect(merged.attributes).toEqual({ id: '1', class: 'first' })
  })

  it('should handle nested elements recursively', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'parent',
        elements: [
          {
            type: 'element',
            name: 'child',
            elements: [{ type: 'text', text: 'First' }],
          },
          {
            type: 'element',
            name: 'child',
            elements: [{ type: 'text', text: 'Second' }],
          },
        ],
      },
    ]

    const result = inlineCommonTags(input)

    const parent = result[0] as XmlElement
    expect(parent.elements).toHaveLength(1)

    const mergedChild = parent.elements![0] as XmlElement
    expect(mergedChild.name).toBe('child')
    expect(mergedChild.elements).toHaveLength(2)
  })

  it('should handle multiple different tags', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'foo',
        elements: [],
      },
      {
        type: 'element',
        name: 'bar',
        elements: [],
      },
      {
        type: 'element',
        name: 'foo',
        elements: [],
      },
      {
        type: 'element',
        name: 'baz',
        elements: [],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(3)
    const names = result.map(el => (el as XmlElement).name).sort()
    expect(names).toEqual(['bar', 'baz', 'foo'])
  })

  it('should preserve single occurrences', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'unique',
        elements: [{ type: 'text', text: 'Content' }],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(input[0])
  })

  it('should handle empty elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'empty',
        elements: [],
      },
      {
        type: 'element',
        name: 'empty',
        elements: [],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(1)
    const merged = result[0] as XmlElement
    expect(merged.name).toBe('empty')
    expect(merged.elements).toBeUndefined()
  })

  it('should handle text nodes between elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'tag',
        elements: [],
      },
      { type: 'text', text: 'Between' },
      {
        type: 'element',
        name: 'tag',
        elements: [],
      },
    ]

    const result = inlineCommonTags(input)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    expect(result[1].type).toBe('element')
  })

  it('should merge deeply nested common tags', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'root',
        elements: [
          {
            type: 'element',
            name: 'level1',
            elements: [
              {
                type: 'element',
                name: 'common',
                elements: [{ type: 'text', text: 'First' }],
              },
              {
                type: 'element',
                name: 'common',
                elements: [{ type: 'text', text: 'Second' }],
              },
            ],
          },
        ],
      },
    ]

    const result = inlineCommonTags(input)

    const root = result[0] as XmlElement
    const level1 = root.elements![0] as XmlElement
    const merged = level1.elements![0] as XmlElement

    expect(merged.name).toBe('common')
    expect(merged.elements).toHaveLength(2)
  })

  it('should handle complex real-world scenario', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'document',
        elements: [
          {
            type: 'element',
            name: 'section',
            attributes: { id: '1' },
            elements: [{ type: 'text', text: 'Section 1' }],
          },
          {
            type: 'element',
            name: 'rules',
            elements: [{ type: 'text', text: 'Rule 1' }],
          },
          {
            type: 'element',
            name: 'section',
            attributes: { id: '2' },
            elements: [{ type: 'text', text: 'Section 2' }],
          },
          {
            type: 'element',
            name: 'rules',
            elements: [{ type: 'text', text: 'Rule 2' }],
          },
        ],
      },
    ]

    const result = inlineCommonTags(input)

    const document = result[0] as XmlElement
    expect(document.elements).toHaveLength(2)

    const section = document.elements!.find(
      el => (el as XmlElement).name === 'section',
    ) as XmlElement
    expect(section.elements).toHaveLength(2)
    expect(section.attributes).toEqual({ id: '1' })

    const rules = document.elements!.find(
      el => (el as XmlElement).name === 'rules',
    ) as XmlElement
    expect(rules.elements).toHaveLength(2)
  })
})
