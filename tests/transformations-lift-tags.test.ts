import { describe, it, expect } from 'vitest'
import { liftAllTagsToRoot } from '../src/transformations'
import { ParsedLine } from '../src/types'

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

  it('should handle deeply nested structures', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'level1',
        elements: [
          {
            type: 'element',
            name: 'level2',
            elements: [
              {
                type: 'element',
                name: 'level3',
                elements: [
                  {
                    type: 'element',
                    name: 'level4',
                    elements: [{ type: 'text', text: 'Deep content' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // When all children are lifted and parent has no text, parent is removed
    expect(result).toHaveLength(1)
    expect((result[0] as any).name).toBe('level4')
  })

  it('should handle multiple root elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'first',
        elements: [
          {
            type: 'element',
            name: 'nested1',
            elements: [],
          },
        ],
      },
      {
        type: 'element',
        name: 'second',
        elements: [
          {
            type: 'element',
            name: 'nested2',
            elements: [],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // Both parent elements are removed because they only contain elements
    expect(result).toHaveLength(2)
    expect((result[0] as any).name).toBe('nested1')
    expect((result[1] as any).name).toBe('nested2')
  })

  it('should handle empty parent elements after lifting', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'wrapper',
        elements: [
          {
            type: 'element',
            name: 'content',
            elements: [{ type: 'text', text: 'Text' }],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // Wrapper is removed, content is lifted
    expect(result).toHaveLength(1)
    const content = result[0] as any
    expect(content.name).toBe('content')
    expect(content.elements[0].text).toBe('Text')
  })

  it('should preserve attributes on lifted elements', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'parent',
        attributes: { id: 'p1' },
        elements: [
          {
            type: 'element',
            name: 'child',
            attributes: { id: 'c1', class: 'test' },
            elements: [],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // Parent with only element children is removed, child is lifted
    expect(result).toHaveLength(1)
    expect((result[0] as any).name).toBe('child')
    expect((result[0] as any).attributes).toEqual({ id: 'c1', class: 'test' })
  })

  it('should handle mixed content types', () => {
    const input: ParsedLine[] = [
      { type: 'text', text: 'Plain text' },
      {
        type: 'element',
        name: 'container',
        elements: [
          {
            type: 'element',
            name: 'nested',
            elements: [],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // Text nodes are preserved, container with only element children is removed
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    expect(result[1].type).toBe('element')
    expect((result[1] as any).name).toBe('nested')
  })

  it('should handle document wrapper specially', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'document',
        elements: [
          {
            type: 'element',
            name: 'section',
            elements: [
              {
                type: 'element',
                name: 'paragraph',
                elements: [{ type: 'text', text: 'Content' }],
              },
            ],
          },
        ],
      },
    ]

    const result = liftAllTagsToRoot(input)

    // Even document wrapper is removed if it only contains elements
    expect(result).toHaveLength(1)
    expect((result[0] as any).name).toBe('paragraph')
    expect((result[0] as any).elements[0].text).toBe('Content')
  })
})
