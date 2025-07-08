import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, readFileSync } from 'fs'
import { extname, resolve } from 'path'
import { homedir } from 'os'
import { runPipeline, runPipelineJson } from './pipeline.js'
import { detectCircularDependencies } from './detect-circular-dependencies.js'

async function main() {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file')
    .option('--json', 'output as JSON instead of formatted tags')
    .option('--indent-spaces <number>', 'indent space (default: 2)')
    .allowExcessArguments(false)
    .action(
      (
        file: string,
        options: {
          json?: boolean
          indentSpaces?: string
        },
      ) => {
        if (file.startsWith('~/')) {
          file = resolve(homedir(), file.slice(2))
        }
        if (!existsSync(file)) {
          throw new Error(`Error: File '${file}' not found`)
        }

        if (extname(file).toLowerCase() !== '.md') {
          throw new Error(
            `Error: File '${file}' is not a markdown file (must end with .md)`,
          )
        }

        const content = readFileSync(file, 'utf-8')

        detectCircularDependencies(file)

        const indentSpaces = options.indentSpaces
          ? parseInt(options.indentSpaces, 10)
          : undefined

        if (
          indentSpaces !== undefined &&
          (isNaN(indentSpaces) || indentSpaces < 0)
        ) {
          throw new Error(
            'Error: --indent-spaces must be a non-negative number',
          )
        }

        if (options.json) {
          const result = runPipelineJson(content, file)
          process.stdout.write(JSON.stringify(result, null, 2))
        } else {
          const output = runPipeline(content, file, { indent: indentSpaces })
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
