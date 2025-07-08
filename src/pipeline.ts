import { parseContent } from './parse-content.js'
import { processMarkdownReferences } from './process-markdown-references.js'
import { renderTags } from './render-tags.js'
import { RenderOptions } from './types.js'

export function runPipeline(
  input: string,
  currentFilePath?: string,
  options?: RenderOptions,
): string {
  const parsed = parseContent(input)
  const processed = processMarkdownReferences(parsed, currentFilePath)
  return renderTags(processed, options)
}
