import { parseContent } from './parse-content.js'
import { processMarkdownReferences } from './process-markdown-references.js'
import { renderTags } from './render-tags.js'
import { RenderOptions } from './types.js'
import {
  liftAllTagsToRoot,
  inlineCommonTags,
  applyRootTagTransformation,
  applyIndentationTransformation,
  sortTagsToBottom,
} from './transformations.js'

export function runPipeline(
  input: string,
  entrypointFilePath?: string,
  options?: RenderOptions,
): string {
  const parsed = parseContent(input)
  let elements = processMarkdownReferences(
    parsed,
    entrypointFilePath,
    entrypointFilePath,
    options,
  )

  if (options?.liftAllTagsToRoot) {
    elements = liftAllTagsToRoot(elements)
  }

  if (options?.inlineCommonTags) {
    elements = inlineCommonTags(elements)
  }

  if (options?.sortTagsToBottom && options.sortTagsToBottom.length > 0) {
    elements = sortTagsToBottom(elements, options.sortTagsToBottom)
  }

  elements = applyRootTagTransformation(elements, {
    rootTag: options?.rootTag,
    noRootTag: options?.noRootTag,
  })

  const xml = renderTags(elements, options?.indent ?? 2)

  return applyIndentationTransformation(xml, options?.indent ?? 2)
}
