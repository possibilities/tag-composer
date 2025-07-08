import { describe, it, expect } from 'vitest'
import { renderTags } from '../src/render-tags'
import { ParsedLine } from '../src/types'
import dedent from 'dedent'

describe('renderTags', () => {
  describe('basic rendering', () => {
    it('should render simple text elements', () => {
      const elements: ParsedLine[] = [{ type: 'text', text: 'Hello world' }]

      const result = renderTags(elements)

      expect(result.trim()).toBe('Hello world')
    })

    it('should render simple elements', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'greeting',
          elements: [{ type: 'text', text: 'Hello' }],
        },
      ]

      const result = renderTags(elements)

      expect(result.trim()).toBe(
        dedent`
        <greeting>
          Hello
        </greeting>
      `.trim(),
      )
    })

    it('should render nested elements', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'outer',
          elements: [
            {
              type: 'element',
              name: 'inner',
              elements: [{ type: 'text', text: 'Content' }],
            },
          ],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <outer>
          <inner>
            Content
          </inner>
        </outer>
      `)
    })

    it('should render multiple root elements', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'first',
          elements: [{ type: 'text', text: 'One' }],
        },
        {
          type: 'element',
          name: 'second',
          elements: [{ type: 'text', text: 'Two' }],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <first>
          One
        </first>
        <second>
          Two
        </second>
      `)
    })
  })

  describe('indentation handling', () => {
    it('should use default indentation of 2 spaces', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'root',
          elements: [
            {
              type: 'element',
              name: 'child',
              elements: [{ type: 'text', text: 'Text' }],
            },
          ],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <root>
          <child>
            Text
          </child>
        </root>
      `)
    })

    it('should handle custom indentation', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'root',
          elements: [
            {
              type: 'element',
              name: 'child',
              elements: [{ type: 'text', text: 'Text' }],
            },
          ],
        },
      ]

      const result = renderTags(elements, 4)

      expect(result).toBe(dedent`
        <root>
            <child>
                Text
            </child>
        </root>
      `)
    })

    it('should handle zero indentation', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'root',
          elements: [
            {
              type: 'element',
              name: 'child',
              elements: [{ type: 'text', text: 'Text' }],
            },
          ],
        },
      ]

      const result = renderTags(elements, 0)

      expect(result).toContain('<root>')
      expect(result).toContain('<child>')
      expect(result).toContain('Text')
      expect(result).toContain('</child>')
      expect(result).toContain('</root>')
    })
  })

  describe('special cases', () => {
    it('should handle empty elements', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'empty',
          elements: [],
        },
      ]

      const result = renderTags(elements)

      expect(result.trim()).toBe('<empty/>')
    })

    it('should handle elements with attributes', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'tag',
          attributes: { id: 'test', class: 'demo' },
          elements: [{ type: 'text', text: 'Content' }],
        },
      ]

      const result = renderTags(elements)

      expect(result.trim()).toBe(
        dedent`
        <tag id="test" class="demo">
          Content
        </tag>
      `.trim(),
      )
    })

    it('should handle mixed content', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'mixed',
          elements: [
            { type: 'text', text: 'Before ' },
            {
              type: 'element',
              name: 'em',
              elements: [{ type: 'text', text: 'emphasis' }],
            },
            { type: 'text', text: ' after' },
          ],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <mixed>
          Before 
          <em>
            emphasis
          </em>
           after
        </mixed>
      `)
    })

    it('should handle empty input', () => {
      const elements: ParsedLine[] = []

      const result = renderTags(elements)

      expect(result).toBe('')
    })

    it('should preserve multi-line text content', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'content',
          elements: [
            {
              type: 'text',
              text: 'Line 1\nLine 2\nLine 3',
            },
          ],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <content>
          Line 1
        Line 2
        Line 3
        </content>
      `)
    })

    it('should handle deeply nested structures', () => {
      const elements: ParsedLine[] = [
        {
          type: 'element',
          name: 'a',
          elements: [
            {
              type: 'element',
              name: 'b',
              elements: [
                {
                  type: 'element',
                  name: 'c',
                  elements: [
                    {
                      type: 'element',
                      name: 'd',
                      elements: [{ type: 'text', text: 'Deep' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]

      const result = renderTags(elements)

      expect(result).toBe(dedent`
        <a>
          <b>
            <c>
              <d>
                Deep
              </d>
            </c>
          </b>
        </a>
      `)
    })
  })
})
