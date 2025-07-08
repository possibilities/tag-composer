import { parseContent } from './parse-content.js'
import { processMarkdownReferences } from './process-markdown-references.js'
import { renderTags } from './render-tags.js'
import { ParsedLine } from './types.js'

export function runPipeline(input: string, currentFilePath?: string): string {
  const parsed = parseContent(input)
  const processed = processMarkdownReferences(parsed, currentFilePath)
  return renderTags(processed)
}

export function runPipelineJson(
  input: string,
  currentFilePath?: string,
): ParsedLine[] {
  const parsed = parseContent(input)
  const processed = processMarkdownReferences(parsed, currentFilePath)
  return processed
}
