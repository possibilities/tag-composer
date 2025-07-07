import { parseContent } from './parse-content.js'
import { parseCommands } from './parse-commands.js'
import { executeCommands } from './execute-commands.js'
import { renderTags } from './render-tags.js'

export function runPipeline(
  input: string,
  callingCommandName?: string,
): string {
  const parsed = parseContent(input)
  const validated = parseCommands(parsed, callingCommandName)
  const executed = executeCommands(validated)
  return renderTags(executed)
}
