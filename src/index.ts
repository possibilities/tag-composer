import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { composeTags } from './lib.js'

function collectRepeated(value: string, previous: string[]) {
  return previous.concat([value])
}

async function main() {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file')
    .option('--no-root-tag', 'omit root tag')
    .option('--inline-common-tags', 'merge multiple tags with the same name')
    .option('--root-tag-name <name>', 'root tag name (default: document)')
    .option('--lift-all-tags-to-root', 'lift all nested tags to the root level')
    .option('--indent-spaces <number>', 'indent space (default: 2)')
    .option(
      '--sort-tag-to-bottom <tag>',
      'sort specified tag to bottom (can be used multiple times)',
      collectRepeated,
      [],
    )
    .option(
      '--convert-path-to-tag-strategy <strategy>',
      'strategy for converting paths to tags (choices: all, head, tail, init, last, rest, none, default: all)',
      'all',
    )
    .option(
      '--tag-case <style>',
      'case style for tag names (choices: pascal, kebab, shout, meme, default: pascal)',
      'pascal',
    )
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
          sortTagToBottom?: string[]
          tagCase?: string
        },
      ) => {
        const output = composeTags(file, {
          indentSpaces: options.indentSpaces,
          rootTagName: options.rootTagName,
          rootTag: options.rootTag,
          convertPathToTagStrategy: options.convertPathToTagStrategy,
          liftAllTagsToRoot: options.liftAllTagsToRoot,
          inlineCommonTags: options.inlineCommonTags,
          sortTagsToBottom: options.sortTagToBottom,
          tagCase: options.tagCase,
        })
        process.stdout.write(output)
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
