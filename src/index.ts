import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync } from 'fs'
import { extname } from 'path'

async function main() {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file to process')
    .action((file: string) => {
      if (!existsSync(file)) {
        console.error(`Error: File '${file}' not found`)
        process.exit(1)
      }

      if (extname(file).toLowerCase() !== '.md') {
        console.error(
          `Error: File '${file}' is not a markdown file (must end with .md)`,
        )
        process.exit(1)
      }

      console.log(`hello ${file}`)
    })

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
      console.error('Error:', error.message)
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
