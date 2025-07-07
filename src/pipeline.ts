import { parseContent } from './parse-content.js'
import { parseCommands } from './parse-commands.js'
import { executeCommands } from './execute-commands.js'
import { renderTags } from './render-tags.js'
import { ParsedLine } from './types.js'

export function runPipeline(
  input: string,
  callingCommandName?: string,
): string {
  const parsed = parseContent(input)
  const validated = parseCommands(parsed, callingCommandName)
  const executed = executeCommands(validated, callingCommandName)
  return renderTags(executed)
}

export function runPipelineJson(
  input: string,
  callingCommandName?: string,
): ParsedLine[] {
  const parsed = parseContent(input)
  const validated = parseCommands(parsed, callingCommandName)
  const executed = executeCommands(validated, callingCommandName)
  return executed
}
