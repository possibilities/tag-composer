import { readFileSync } from 'fs'
import { runPipeline } from './pipeline.js'
import { detectCircularDependencies } from './detect-circular-dependencies.js'
import { cliArgsSchema } from './cli-schema.js'
import { ZodError } from 'zod'
import type {
  PathToTagStrategy,
  XmlElement,
  XmlNode,
  RenderOptions,
} from './types.js'

export interface ComposeTagsOptions {
  indentSpaces?: string | number
  rootTagName?: string
  rootTag?: boolean
  convertPathToTagStrategy?: string
  liftAllTagsToRoot?: boolean
  inlineCommonTags?: boolean
}

export function composeTags(
  filePath: string,
  options?: ComposeTagsOptions,
): string {
  try {
    const argsToValidate = {
      file: filePath,
      indentSpaces: options?.indentSpaces,
      rootTagName: options?.rootTagName,
      rootTag: options?.rootTag,
      convertPathToTagStrategy: options?.convertPathToTagStrategy,
      liftAllTagsToRoot: options?.liftAllTagsToRoot,
      inlineCommonTags: options?.inlineCommonTags,
    }

    const validatedArgs = cliArgsSchema.parse(argsToValidate)

    const content = readFileSync(validatedArgs.file, 'utf-8')
    detectCircularDependencies(validatedArgs.file)

    const shouldOmitRootTag = validatedArgs.rootTag === false
    const output = runPipeline(content, validatedArgs.file, {
      indent: validatedArgs.indentSpaces,
      rootTag: validatedArgs.rootTagName,
      noRootTag: shouldOmitRootTag,
      pathToTagStrategy: validatedArgs.convertPathToTagStrategy,
      liftAllTagsToRoot: validatedArgs.liftAllTagsToRoot,
      inlineCommonTags: validatedArgs.inlineCommonTags,
    })

    return output
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0]
      throw new Error(`Error: ${firstError.message}`)
    }
    throw error
  }
}

export type { PathToTagStrategy, XmlElement, XmlNode, RenderOptions }
