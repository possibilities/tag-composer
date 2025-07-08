import { dirname, normalize, resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { ParsedLine, MarkdownReference, XmlNode, XmlElement } from './types.js'
import { parseContent } from './parse-content.js'

function isMarkdownReference(
  item: ParsedLine | MarkdownReference,
): item is MarkdownReference {
  return 'type' in item && item.type === 'markdown-reference'
}

function extractDirectorySegments(filePath: string): string[] {
  const normalizedPath = normalize(filePath)
  const directoryPath = dirname(normalizedPath)

  if (directoryPath === '.' || directoryPath === '') {
    return []
  }

  const pathParts = directoryPath.split('/')
  const validDirectoryNames = pathParts.filter(segment => {
    return segment !== '' && segment !== '.' && !/^\.+$/.test(segment)
  })

  return validDirectoryNames
}

function wrapInNestedTags(
  segments: string[],
  content: ParsedLine[],
): ParsedLine[] {
  if (segments.length === 0) {
    return content
  }

  const innerSegment = segments[segments.length - 1]
  const outerSegments = segments.slice(0, -1)

  const wrappedElement: XmlElement = {
    type: 'element',
    name: innerSegment,
    elements: content,
  }

  return wrapInNestedTags(outerSegments, [wrappedElement])
}

function resolveMarkdownPath(
  referencePath: string,
  currentMarkdownFile: string | undefined,
): string {
  if (referencePath.startsWith('/')) {
    return referencePath
  }

  if (currentMarkdownFile) {
    return resolve(dirname(currentMarkdownFile), referencePath)
  }

  return resolve(process.cwd(), referencePath)
}

function processMarkdownFile(
  reference: MarkdownReference,
  currentFilePath?: string,
): ParsedLine[] {
  const resolvedFilePath = resolveMarkdownPath(reference.path, currentFilePath)

  if (!existsSync(resolvedFilePath)) {
    throw new Error(`Error: File '${resolvedFilePath}' not found`)
  }

  const content = readFileSync(resolvedFilePath, 'utf-8')
  const parsed = parseContent(content)
  const processed = processMarkdownReferences(parsed, resolvedFilePath)

  let directorySegments: string[] = []

  if (!reference.path.startsWith('/')) {
    directorySegments = extractDirectorySegments(reference.path)
  }

  return wrapInNestedTags(directorySegments, processed)
}

export function processMarkdownReferences(
  items: (ParsedLine | MarkdownReference)[],
  currentFilePath?: string,
): ParsedLine[] {
  return items.flatMap(item => {
    if (isMarkdownReference(item)) {
      return processMarkdownFile(item, currentFilePath)
    }

    if ('elements' in item && item.elements) {
      const processedElements: XmlNode[] = item.elements.map(elem => {
        if (elem.type === 'element' && elem.elements) {
          const processed = processMarkdownReferences(
            [elem],
            currentFilePath,
          )[0]
          return processed
        }
        return elem
      })

      return {
        ...item,
        elements: processedElements,
      }
    }

    return item
  })
}
