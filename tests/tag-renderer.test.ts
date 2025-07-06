import dedent from 'dedent'
import { describe, it, expect } from 'vitest'
import { renderToTags } from '../src/tag-renderer'

describe('renderToTags', () => {
  describe('generic rendering', () => {
    it('should render any object with type field as wrapper tag', () => {
      const lines = [
        {
          type: 'user',
          name: 'John Doe',
          age: 30,
          active: true,
        },
        {
          type: 'product',
          title: 'Widget',
          price: 19.99,
          inStock: false,
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <user>
            <name>John Doe</name>
            <age>30</age>
            <active>true</active>
          </user>
          <product>
            <title>Widget</title>
            <price>19.99</price>
            <inStock>false</inStock>
          </product>
        </document>
      `)
    })

    it('should handle empty strings as self-closing tags', () => {
      const lines = [
        {
          type: 'entry',
          title: 'My Entry',
          description: '',
          tags: '',
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <entry>
            <title>My Entry</title>
            <description />
            <tags />
          </entry>
        </document>
      `)
    })

    it('should handle numeric and boolean values', () => {
      const lines = [
        {
          type: 'config',
          version: 1.5,
          enabled: true,
          disabled: false,
          count: 0,
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <config>
            <version>1.5</version>
            <enabled>true</enabled>
            <disabled>false</disabled>
            <count>0</count>
          </config>
        </document>
      `)
    })

    it('should handle custom indentation', () => {
      const lines = [
        {
          type: 'item',
          value: 'test',
        },
      ]

      const result = renderToTags(lines, { indent: '    ' })

      expect(result).toBe(dedent`
        <document>
            <item>
                <value>test</value>
            </item>
        </document>
      `)
    })

    it('should handle empty input', () => {
      const lines: any[] = []

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
        </document>
      `)
    })
  })

  describe('parse-content integration', () => {
    it('should render text nodes from parser', () => {
      const lines = [
        {
          type: 'text',
          content: 'hello world',
        },
        {
          type: 'text',
          content: 'goodbye world',
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <text>
            <content>hello world</content>
          </text>
          <text>
            <content>goodbye world</content>
          </text>
        </document>
      `)
    })

    it('should render command nodes from parser', () => {
      const lines = [
        {
          type: 'command',
          content: 'echo "test"',
          commandName: 'echo',
          statusCode: 0,
          stdout: 'test\n',
          stderr: '',
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <command>
            <content>echo "test"</content>
            <commandName>echo</commandName>
            <statusCode>0</statusCode>
            <stdout>test</stdout>
            <stderr />
          </command>
        </document>
      `)
    })

    it('should render mixed parser output', () => {
      const lines = [
        {
          type: 'text',
          content: 'Starting script',
        },
        {
          type: 'command',
          content: 'false',
          commandName: 'false',
          statusCode: 1,
          stdout: '',
          stderr: 'error occurred\n',
        },
        {
          type: 'text',
          content: 'Script failed',
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <text>
            <content>Starting script</content>
          </text>
          <command>
            <content>false</content>
            <commandName>false</commandName>
            <statusCode>1</statusCode>
            <stdout />
            <stderr>error occurred</stderr>
          </command>
          <text>
            <content>Script failed</content>
          </text>
        </document>
      `)
    })

    it('should trim trailing whitespace from values', () => {
      const lines = [
        {
          type: 'output',
          content: 'data with trailing spaces   ',
          multiline: 'line1\nline2\n',
        },
      ]

      const result = renderToTags(lines)

      expect(result).toBe(dedent`
        <document>
          <output>
            <content>data with trailing spaces</content>
            <multiline>line1
line2</multiline>
          </output>
        </document>
      `)
    })
  })
})
