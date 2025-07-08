import { describe, it, expect } from 'vitest'
import { liftAllTagsToRoot, inlineCommonTags } from '../src/transformations.js'
import { ParsedLine } from '../src/types.js'

describe('liftAllTagsToRoot', () => {
  it('should lift nested tags to root level', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'document',
        elements: [
          {
            type: 'element',
            name: 'query',
            elements: [{ type: 'text', text: "Don't do anything right now" }],
          },
          {
            type: 'element',
            name: 'roles',
            elements: [
              {
                type: 'text',
                text: 'You are an experienced software engineer',
              },
              {
                type: 'element',
                name: 'rules',
                elements: [
                  {
                    type: 'text',
                    text: 'When you have made multiple attempts...',
                  },
                ],
              },
              {
                type: 'element',
                name: 'rules',
                elements: [{ type: 'text', text: "We don't like comments..." }],
              },
            ],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('element')
    expect((result[0] as any).name).toBe('document')
    expect((result[0] as any).elements).toHaveLength(2)

    expect(result[1].type).toBe('element')
    expect((result[1] as any).name).toBe('rules')

    expect(result[2].type).toBe('element')
    expect((result[2] as any).name).toBe('rules')
  })

  it('should preserve text content in parent elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'parent',
        elements: [
          { type: 'text', text: 'Before child' },
          {
            type: 'element',
            name: 'child',
            elements: [{ type: 'text', text: 'Child content' }],
          },
          { type: 'text', text: 'After child' },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    expect(result).toHaveLength(2)
    const parent = result[0] as any
    expect(parent.elements).toHaveLength(2)
    expect(parent.elements[0].text).toBe('Before child')
    expect(parent.elements[1].text).toBe('After child')
  })
})

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
    const document = result[0] as any
    expect(document.elements).toHaveLength(1)

    const mergedRules = document.elements[0]
    expect(mergedRules.name).toBe('rules')
    expect(mergedRules.elements).toHaveLength(3)
    expect(mergedRules.elements[0].text).toBe('First rule')
    expect(mergedRules.elements[1].text).toBe('Second rule')
    expect(mergedRules.elements[2].text).toBe('Third rule')
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
    const merged = result[0] as any
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

    const parent = result[0] as any
    expect(parent.elements).toHaveLength(1)

    const mergedChild = parent.elements[0]
    expect(mergedChild.name).toBe('child')
    expect(mergedChild.elements).toHaveLength(2)
  })
})
