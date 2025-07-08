import { parseContent } from './parse-content.js'
import { processMarkdownReferences } from './process-markdown-references.js'
import { renderTags } from './render-tags.js'
import { RenderOptions } from './types.js'
import { liftAllTagsToRoot, inlineCommonTags } from './transformations.js'

export function runPipeline(
  input: string,
  currentFilePath?: string,
  options?: RenderOptions,
): string {
  const parsed = parseContent(input)
  let processed = processMarkdownReferences(parsed, currentFilePath, options)

  if (options?.liftAllTagsToRoot) {
    processed = liftAllTagsToRoot(processed)
  }

  if (options?.inlineCommonTags) {
    processed = inlineCommonTags(processed)
  }

  return renderTags(processed, options)
}
