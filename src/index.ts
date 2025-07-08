import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { readFileSync } from 'fs'
import { runPipeline } from './pipeline.js'
import { detectCircularDependencies } from './detect-circular-dependencies.js'
import { cliArgsSchema } from './cli-schema.js'
import { ZodError } from 'zod'

async function main() {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file')
    .option('--indent-spaces <number>', 'indent space (default: 2)')
    .option('--root-tag-name <name>', 'root tag name (default: document)')
    .option('--no-root-tag', 'omit root tag')
    .option(
      '--convert-path-to-tag-strategy <strategy>',
      'strategy for converting paths to tags (choices: all, head, tail, init, last, rest, none, default: all)',
      'all',
    )
    .option('--lift-all-tags-to-root', 'lift all nested tags to the root level')
    .option('--inline-common-tags', 'merge multiple tags with the same name')
    .allowExcessArguments(false)
    .action(
      (
        file: string,
        options: {
          indentSpaces?: string
          rootTagName?: string
          rootTag?: boolean
          convertPathToTagStrategy?: string
          liftAllTagsToRoot?: boolean
          inlineCommonTags?: boolean
        },
      ) => {
        try {
          const validatedArgs = cliArgsSchema.parse({
            file,
            indentSpaces: options.indentSpaces,
            rootTagName: options.rootTagName,
            rootTag: options.rootTag,
            convertPathToTagStrategy: options.convertPathToTagStrategy,
            liftAllTagsToRoot: options.liftAllTagsToRoot,
            inlineCommonTags: options.inlineCommonTags,
          })

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
          process.stdout.write(output)
        } catch (error) {
          if (error instanceof ZodError) {
            const firstError = error.errors[0]
            throw new Error(`Error: ${firstError.message}`)
          }
          throw error
        }
      },
    )

  try {
    program.exitOverride()
    program.configureOutput({
      writeErr: str => process.stderr.write(str),
    })

    await program.parseAsync(process.argv)
  } catch (error) {
    if (error instanceof Error) {
      const commanderError = error as Error & { code?: string }
      if (
        commanderError.code === 'commander.help' ||
        commanderError.code === 'commander.helpDisplayed' ||
        commanderError.code === 'commander.version'
      ) {
        process.exit(0)
      }
      if (error.message.startsWith('Error: ')) {
        console.error(error.message)
      } else {
        console.error('Error:', error.message)
      }
    } else {
      console.error('Error:', error)
    }
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
