import { dirname, normalize, relative, resolve } from 'path'
import { spawnSync } from 'child_process'
import { ParsedLine, MarkdownReference, XmlElement, XmlNode } from './types.js'

function isMarkdownReference(
  item: ParsedLine | MarkdownReference,
): item is MarkdownReference {
  return 'type' in item && item.type === 'markdown-reference'
}

function resolvePath(
  pathArg: string,
  currentFile: string | undefined,
  resolveRelativeToCwd: boolean,
): string {
  if (pathArg.startsWith('/')) {
    return pathArg
  } else {
    if (resolveRelativeToCwd || !currentFile) {
      return resolve(process.cwd(), pathArg)
    } else {
      return resolve(dirname(currentFile), pathArg)
    }
  }
}

function extractDirectorySegments(filePath: string): string[] {
  const normalizedPath = normalize(filePath)
  const directoryPath = dirname(normalizedPath)

  if (directoryPath === '.' || directoryPath === '') {
    return []
  }

  const segments = directoryPath.split('/')
  const filteredSegments = segments.filter(segment => {
    return segment !== '' && segment !== '.' && !/^\.+$/.test(segment)
  })

  return filteredSegments
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

function processMarkdownFile(
  reference: MarkdownReference,
  currentFilePath?: string,
  resolveRelativeToCwd?: boolean,
): ParsedLine[] {
  const resolvedFilePath = resolvePath(
    reference.path,
    currentFilePath,
    resolveRelativeToCwd === true,
  )

  const cliPath = new URL('../dist/cli.js', import.meta.url).pathname
  const command = `node ${cliPath} --json --no-recursion-check --no-resolve-markdown-relative-to-cwd "${resolvedFilePath}"`

  const result = spawnSync('sh', ['-c', command], {
    encoding: 'utf8',
    shell: false,
  })

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `Failed to process ${reference.path}`,
    )
  }

  try {
    const parsedJson: ParsedLine[] = JSON.parse(result.stdout)

    const cwd = process.cwd()

    let directorySegments: string[] = []

    // Only add directory segments when resolving relative to CWD
    if (
      resolveRelativeToCwd === true &&
      resolvedFilePath.startsWith(cwd) &&
      !reference.path.startsWith('/')
    ) {
      const relativeToCwd = relative(cwd, resolvedFilePath)
      directorySegments = extractDirectorySegments(relativeToCwd)
    } else if (
      resolveRelativeToCwd === true &&
      !reference.path.startsWith('/')
    ) {
      const normalizedPath = normalize(reference.path)
      directorySegments = extractDirectorySegments(normalizedPath)
    } else {
      // When resolving relative to markdown file or absolute paths, don't add directory tags
      directorySegments = []
    }

    return wrapInNestedTags(directorySegments, parsedJson)
  } catch (error) {
    throw new Error(
      `Failed to parse output from ${reference.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

export function processMarkdownReferences(
  items: (ParsedLine | MarkdownReference)[],
  currentFilePath?: string,
  resolveRelativeToCwd?: boolean,
): ParsedLine[] {
  return items.flatMap(item => {
    if (isMarkdownReference(item)) {
      return processMarkdownFile(item, currentFilePath, resolveRelativeToCwd)
    }

    if ('elements' in item && item.elements) {
      const processedElements: XmlNode[] = item.elements.map(elem => {
        if (elem.type === 'element' && elem.elements) {
          const processed = processMarkdownReferences(
            [elem],
            currentFilePath,
            resolveRelativeToCwd,
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
