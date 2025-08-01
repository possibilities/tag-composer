import { dirname, normalize, resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import {
  ParsedLine,
  MarkdownReference,
  XmlNode,
  XmlElement,
  PathToTagStrategy,
  RenderOptions,
} from './types.js'
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

function applyPathStrategy(
  segments: string[],
  strategy: PathToTagStrategy = 'all',
): string[] {
  if (segments.length === 0) return segments

  switch (strategy) {
    case 'all':
      return segments
    case 'head':
      return segments.slice(0, 1)
    case 'tail':
    case 'rest':
      return segments.slice(1)
    case 'init':
      return segments.slice(0, -1)
    case 'last':
      return segments.slice(-1)
    case 'none':
      return []
  }
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

function resolveMarkdownPathFromEntrypoint(
  referencePath: string,
  entrypointPath: string,
): string {
  if (referencePath.startsWith('/')) {
    return referencePath
  }

  return resolve(dirname(entrypointPath), referencePath)
}

function processMarkdownFile(
  reference: MarkdownReference,
  _currentFilePath?: string,
  entrypointPath?: string,
  options?: RenderOptions,
): ParsedLine[] {
  const resolvedFilePath = resolveMarkdownPathFromEntrypoint(
    reference.path,
    entrypointPath!,
  )

  if (!existsSync(resolvedFilePath)) {
    throw new Error(`Error: File '${resolvedFilePath}' not found`)
  }

  const content = readFileSync(resolvedFilePath, 'utf-8')
  const parsed = parseContent(content)
  const processed = processMarkdownReferences(
    parsed,
    resolvedFilePath,
    entrypointPath,
    options,
  )

  let directorySegments: string[] = []

  if (!reference.path.startsWith('/')) {
    directorySegments = extractDirectorySegments(reference.path)
    directorySegments = applyPathStrategy(
      directorySegments,
      options?.pathToTagStrategy,
    )
  }

  return wrapInNestedTags(directorySegments, processed)
}

export function processMarkdownReferences(
  items: (ParsedLine | MarkdownReference)[],
  currentFilePath?: string,
  entrypointPath?: string,
  options?: RenderOptions,
): ParsedLine[] {
  return items.flatMap(item => {
    if (isMarkdownReference(item)) {
      return processMarkdownFile(item, currentFilePath, entrypointPath, options)
    }

    if ('elements' in item && item.elements) {
      const processedElements: XmlNode[] = item.elements.map(elem => {
        if (elem.type === 'element' && elem.elements) {
          const processed = processMarkdownReferences(
            [elem],
            currentFilePath,
            entrypointPath,
            options,
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
