import { dirname, resolve } from 'path'
import { spawnSync } from 'child_process'
import { ParsedLine, MarkdownReference, XmlNode } from './types.js'

function isMarkdownReference(
  item: ParsedLine | MarkdownReference,
): item is MarkdownReference {
  return 'type' in item && item.type === 'markdown-reference'
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

  const cliPath = new URL('../dist/cli.js', import.meta.url).pathname
  const command = `node ${cliPath} --json "${resolvedFilePath}"`

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
    return parsedJson
  } catch (error) {
    throw new Error(
      `Failed to parse output from ${reference.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
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
