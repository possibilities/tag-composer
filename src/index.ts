import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, readFileSync } from 'fs'
import { extname, resolve } from 'path'
import { homedir } from 'os'
import { runPipeline } from './pipeline.js'
import { detectCircularDependencies } from './detect-circular-dependencies.js'

function isValidTagName(name: string): boolean {
  if (name.toLowerCase().startsWith('xml')) return false

  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)
}

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
    .allowExcessArguments(false)
    .action(
      (
        file: string,
        options: {
          indentSpaces?: string
          rootTagName?: string
          rootTag?: boolean
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

        if (options.rootTagName && !isValidTagName(options.rootTagName)) {
          throw new Error(
            `Error: Invalid tag name '${options.rootTagName}'. Tag names must start with a letter and contain only letters, numbers, and hyphens.`,
          )
        }

        const shouldOmitRootTag = options.rootTag === false
        const output = runPipeline(content, file, {
          indent: indentSpaces,
          rootTag: options.rootTagName,
          noRootTag: shouldOmitRootTag,
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
