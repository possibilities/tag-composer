import { parseContent } from './parse-content.js'
import { processMarkdownReferences } from './process-markdown-references.js'
import { renderTags } from './render-tags.js'
import { ParsedLine } from './types.js'

export function runPipeline(
  input: string,
  currentFilePath?: string,
  resolveRelativeToCwd?: boolean,
): string {
  const parsed = parseContent(input)
  const processed = processMarkdownReferences(
    parsed,
    currentFilePath,
    resolveRelativeToCwd,
  )
  return renderTags(processed)
}

export function runPipelineJson(
  input: string,
  currentFilePath?: string,
  resolveRelativeToCwd?: boolean,
): ParsedLine[] {
  const parsed = parseContent(input)
  const processed = processMarkdownReferences(
    parsed,
    currentFilePath,
    resolveRelativeToCwd,
  )
  return processed
}
