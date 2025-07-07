import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'
import { runPipeline, runPipelineJson } from './pipeline.js'
import { detectCircularDependencies } from './detect-circular-dependencies.js'

async function main() {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file to process')
    .option('--json', 'output as JSON instead of formatted tags')
    .option(
      '--recursion-check',
      'check for circular dependencies (default: true)',
    )
    .option('--no-recursion-check', 'skip circular dependency check')
    .allowExcessArguments(false)
    .action(
      (file: string, options: { json?: boolean; recursionCheck?: boolean }) => {
        if (!existsSync(file)) {
          throw new Error(`Error: File '${file}' not found`)
        }

        if (extname(file).toLowerCase() !== '.md') {
          throw new Error(
            `Error: File '${file}' is not a markdown file (must end with .md)`,
          )
        }

        const content = readFileSync(file, 'utf-8')

        if (options.recursionCheck !== false) {
          detectCircularDependencies(file, 'tag-composer')
        }

        if (options.json) {
          const result = runPipelineJson(content, 'tag-composer')
          process.stdout.write(JSON.stringify(result, null, 2))
        } else {
          const output = runPipeline(content, 'tag-composer')
          process.stdout.write(output)
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
