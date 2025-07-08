import { describe, it, expect } from 'vitest'
import { applyRootTagTransformation } from '../src/transformations'
import { ParsedLine } from '../src/types'

describe('applyRootTagTransformation', () => {
  describe('default behavior', () => {
    it('should wrap elements in default document tag', () => {
      const elements: ParsedLine[] = [
        { type: 'text', text: 'Hello world' },
        {
          type: 'element',
          name: 'foo',
          elements: [{ type: 'text', text: 'bar' }],
        },
      ]

      const result = applyRootTagTransformation(elements)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'element',
        name: 'document',
        elements: elements,
      })
    })

    it('should handle empty elements array', () => {
      const elements: ParsedLine[] = []

      const result = applyRootTagTransformation(elements)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'element',
        name: 'document',
        elements: [],
      })
    })
  })

  describe('custom root tag', () => {
    it('should use custom root tag name', () => {
      const elements: ParsedLine[] = [{ type: 'text', text: 'Content' }]

      const result = applyRootTagTransformation(elements, {
        rootTag: 'custom-root',
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'element',
        name: 'custom-root',
        elements: elements,
      })
    })

    it('should handle hyphenated root tag names', () => {
      const elements: ParsedLine[] = [
        { type: 'element', name: 'child', elements: [] },
      ]

      const result = applyRootTagTransformation(elements, {
        rootTag: 'my-root-tag',
      })

      expect(result[0]).toMatchObject({
        name: 'my-root-tag',
      })
    })
  })

  describe('no root tag option', () => {
    it('should return elements unchanged when noRootTag is true', () => {
      const elements: ParsedLine[] = [
        { type: 'text', text: 'First' },
        { type: 'element', name: 'second', elements: [] },
        { type: 'text', text: 'Third' },
      ]

      const result = applyRootTagTransformation(elements, { noRootTag: true })

      expect(result).toEqual(elements)
      expect(result).toHaveLength(3)
    })

    it('should ignore rootTag option when noRootTag is true', () => {
      const elements: ParsedLine[] = [
        { type: 'element', name: 'test', elements: [] },
      ]

      const result = applyRootTagTransformation(elements, {
        noRootTag: true,
        rootTag: 'ignored',
      })

      expect(result).toEqual(elements)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('test')
    })
  })

  describe('complex scenarios', () => {
    it('should handle deeply nested elements', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'level1',
          elements: [
            {
              type: 'element',
              name: 'level2',
              elements: [{ type: 'text', text: 'Deep content' }],
            },
          ],
        },
      ]

      const result = applyRootTagTransformation(elements, {
        rootTag: 'wrapper',
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('wrapper')
      expect(result[0].elements).toEqual(elements)
    })

    it('should handle mixed content types', () => {
      const elements: ParsedLine[] = [
        { type: 'text', text: 'Start' },
        { type: 'element', name: 'middle', elements: [] },
        { type: 'text', text: 'End' },
      ]

      const result = applyRootTagTransformation(elements)

      expect(result[0].elements).toHaveLength(3)
      expect(result[0].elements).toEqual(elements)
    })

    it('should preserve element attributes', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'item',
          attributes: { id: '123', class: 'test' },
          elements: [],
        },
      ]

      const result = applyRootTagTransformation(elements)

      expect(result[0].elements[0]).toHaveProperty('attributes')
      expect(result[0].elements[0].attributes).toEqual({
        id: '123',
        class: 'test',
      })
    })
  })
})
