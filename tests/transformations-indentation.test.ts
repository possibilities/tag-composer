import { describe, it, expect } from 'vitest'
import { applyIndentationTransformation } from '../src/transformations'
import dedent from 'dedent'

describe('applyIndentationTransformation', () => {
  describe('default behavior (indent = 2)', () => {
    it('should preserve XML with standard indentation', () => {
      const xml = dedent`
        <document>
          <foo>
            <bar>Content</bar>
          </foo>
        </document>
      `

      const result = applyIndentationTransformation(xml, 2)

      expect(result).toBe(xml)
    })

    it('should handle any positive indentation value', () => {
      const xml = dedent`
        <root>
            <child>Text</child>
        </root>
      `

      const result = applyIndentationTransformation(xml, 4)

      expect(result).toBe(xml)
    })
  })

  describe('zero indentation', () => {
    it('should remove indentation from simple tags', () => {
      const xml = dedent`
        <document>
          <foo>
            Text content
          </foo>
        </document>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <document>
        <foo>
          Text content
        </foo>
        </document>
      `)
    })

    it('should preserve text content indentation', () => {
      const xml = dedent`
        <document>
          <code>
            function example() {
              return true;
            }
          </code>
        </document>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <document>
        <code>
          function example() {
            return true;
          }
        </code>
        </document>
      `)
    })

    it('should handle self-closing tags', () => {
      const xml = dedent`
        <root>
          <empty />
          <another-empty />
        </root>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <root>
        <empty />
        <another-empty />
        </root>
      `)
    })

    it('should handle deeply nested structures', () => {
      const xml = dedent`
        <a>
          <b>
            <c>
              <d>
                Deep
              </d>
            </c>
          </b>
        </a>
      `

      const result = applyIndentationTransformation(xml, 0)

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

    it('should handle mixed content', () => {
      const xml = dedent`
        <document>
          Text before
          <element>
            Nested text
          </element>
          Text after
        </document>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <document>
         Text before
        <element>
          Nested text
        </element>
         Text after
        </document>
      `)
    })

    it('should handle empty lines', () => {
      const xml = dedent`
        <document>
          <paragraph>
            First line
        
            Second line
          </paragraph>
        </document>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <document>
        <paragraph>
          First line
        
          Second line
        </paragraph>
        </document>
      `)
    })

    it('should handle list-like structures', () => {
      const xml = dedent`
        <list>
          <item>
            - First
              - Nested
                - Deep nested
          </item>
        </list>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <list>
        <item>
          - First
            - Nested
              - Deep nested
        </item>
        </list>
      `)
    })

    it('should handle complex real-world XML', () => {
      const xml = dedent`
        <document>
          <header>
            # Title
            ## Subtitle
          </header>
          <content>
            <section>
              Some text here
              <code>
                const x = 1;
                const y = 2;
              </code>
              More text
            </section>
          </content>
        </document>
      `

      const result = applyIndentationTransformation(xml, 0)

      expect(result).toBe(dedent`
        <document>
        <header>
          # Title
          ## Subtitle
        </header>
        <content>
        <section>
           Some text here
        <code>
            const x = 1;
            const y = 2;
        </code>
           More text
        </section>
        </content>
        </document>
      `)
    })
  })

  describe('edge cases', () => {
    it('should handle empty XML', () => {
      const xml = ''
      const result = applyIndentationTransformation(xml, 0)
      expect(result).toBe('')
    })

    it('should handle single line XML', () => {
      const xml = '<root><child>Text</child></root>'
      const result = applyIndentationTransformation(xml, 0)
      expect(result).toBe(xml)
    })

    it('should handle XML with only whitespace', () => {
      const xml = '   \n  \n   '
      const result = applyIndentationTransformation(xml, 0)
      expect(result).toBe('\n\n')
    })
  })
})
