import { describe, it, expect } from 'vitest'
import { sortTagsToBottom } from '../src/transformations'
import { ParsedLine, XmlElement } from '../src/types'

describe('sortTagsToBottom', () => {
  it('should return elements unchanged when no tags are specified', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'a' },
      { type: 'element', name: 'b' },
      { type: 'element', name: 'c' },
    ]

    const result = sortTagsToBottom(input, [])
    expect(result).toEqual(input)
  })

  it('should sort specified tags to bottom at root level', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'a' },
      { type: 'element', name: 'bar' },
      { type: 'element', name: 'b' },
      { type: 'element', name: 'c' },
      { type: 'element', name: 'foo' },
    ]

    const result = sortTagsToBottom(input, ['foo', 'bar'])

    expect(result).toHaveLength(5)
    expect((result[0] as XmlElement).name).toBe('a')
    expect((result[1] as XmlElement).name).toBe('b')
    expect((result[2] as XmlElement).name).toBe('c')
    expect((result[3] as XmlElement).name).toBe('foo')
    expect((result[4] as XmlElement).name).toBe('bar')
  })

  it('should sort tags recursively at all levels', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'parent',
        elements: [
          { type: 'element', name: 'a' },
          { type: 'element', name: 'bar' },
          { type: 'element', name: 'b' },
          { type: 'element', name: 'foo' },
        ],
      },
      { type: 'element', name: 'bar' },
      { type: 'element', name: 'other' },
    ]

    const result = sortTagsToBottom(input, ['foo', 'bar'])

    expect(result).toHaveLength(3)

    const parent = result[0] as XmlElement
    expect(parent.name).toBe('parent')
    expect(parent.elements).toHaveLength(4)
    expect((parent.elements![0] as XmlElement).name).toBe('a')
    expect((parent.elements![1] as XmlElement).name).toBe('b')
    expect((parent.elements![2] as XmlElement).name).toBe('foo')
    expect((parent.elements![3] as XmlElement).name).toBe('bar')

    expect((result[1] as XmlElement).name).toBe('other')
    expect((result[2] as XmlElement).name).toBe('bar')
  })

  it('should preserve text nodes and their positions', () => {
    const input: ParsedLine[] = [
      { type: 'text', text: 'Some text' },
      { type: 'element', name: 'foo' },
      { type: 'text', text: 'More text' },
      { type: 'element', name: 'a' },
      { type: 'element', name: 'bar' },
    ]

    const result = sortTagsToBottom(input, ['foo', 'bar'])

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ type: 'text', text: 'Some text' })
    expect(result[1]).toEqual({ type: 'text', text: 'More text' })
    expect((result[2] as XmlElement).name).toBe('a')
    expect((result[3] as XmlElement).name).toBe('foo')
    expect((result[4] as XmlElement).name).toBe('bar')
  })

  it('should handle deeply nested structures', () => {
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
                name: 'level2',
                elements: [
                  { type: 'element', name: 'a' },
                  { type: 'element', name: 'foo' },
                  { type: 'element', name: 'b' },
                ],
              },
              { type: 'element', name: 'bar' },
            ],
          },
          { type: 'element', name: 'foo' },
        ],
      },
    ]

    const result = sortTagsToBottom(input, ['foo', 'bar'])

    const root = result[0] as XmlElement
    const level1 = root.elements![0] as XmlElement
    const level2 = level1.elements![0] as XmlElement

    expect((level2.elements![0] as XmlElement).name).toBe('a')
    expect((level2.elements![1] as XmlElement).name).toBe('b')
    expect((level2.elements![2] as XmlElement).name).toBe('foo')

    expect((level1.elements![1] as XmlElement).name).toBe('bar')
    expect((root.elements![1] as XmlElement).name).toBe('foo')
  })

  it('should respect configuration array order for bottom tags', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'a' },
      { type: 'element', name: 'foo' },
      { type: 'element', name: 'b' },
      { type: 'element', name: 'bar' },
      { type: 'element', name: 'c' },
      { type: 'element', name: 'foo' },
    ]

    const result = sortTagsToBottom(input, ['bar', 'foo'])

    expect(result).toHaveLength(6)
    expect((result[0] as XmlElement).name).toBe('a')
    expect((result[1] as XmlElement).name).toBe('b')
    expect((result[2] as XmlElement).name).toBe('c')
    expect((result[3] as XmlElement).name).toBe('bar')
    expect((result[4] as XmlElement).name).toBe('foo')
    expect((result[5] as XmlElement).name).toBe('foo')
  })

  it('should sort bottom tags according to configuration array order', () => {
    const input: ParsedLine[] = [
      { type: 'element', name: 'rules' },
      { type: 'element', name: 'roles' },
      { type: 'element', name: 'other' },
      { type: 'element', name: 'query' },
      { type: 'element', name: 'instructions' },
    ]

    const result = sortTagsToBottom(input, [
      'roles',
      'rules',
      'instructions',
      'query',
    ])

    expect(result).toHaveLength(5)
    expect((result[0] as XmlElement).name).toBe('other')
    expect((result[1] as XmlElement).name).toBe('roles')
    expect((result[2] as XmlElement).name).toBe('rules')
    expect((result[3] as XmlElement).name).toBe('instructions')
    expect((result[4] as XmlElement).name).toBe('query')
  })

  it('should handle elements with attributes', () => {
    const input: ParsedLine[] = [
      {
        type: 'element',
        name: 'a',
        attributes: { id: '1' },
      },
      {
        type: 'element',
        name: 'foo',
        attributes: { class: 'bottom' },
      },
      {
        type: 'element',
        name: 'b',
      },
    ]

    const result = sortTagsToBottom(input, ['foo'])

    expect(result).toHaveLength(3)
    expect((result[0] as XmlElement).name).toBe('a')
    expect((result[0] as XmlElement).attributes).toEqual({ id: '1' })
    expect((result[1] as XmlElement).name).toBe('b')
    expect((result[2] as XmlElement).name).toBe('foo')
    expect((result[2] as XmlElement).attributes).toEqual({ class: 'bottom' })
  })
})
