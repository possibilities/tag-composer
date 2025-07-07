import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync } from 'fs'
import { extname } from 'path'

export function createCliCommand(): Command {
  const program = new Command()

  program
    .name('tag-composer')
    .description('Tag Composer CLI')
    .version(packageJson.version)
    .argument('<file>', 'markdown file to process')
    .allowExcessArguments(false)
    .action((file: string) => {
      if (!existsSync(file)) {
        throw new Error(`Error: File '${file}' not found`)
      }

      if (extname(file).toLowerCase() !== '.md') {
        throw new Error(
          `Error: File '${file}' is not a markdown file (must end with .md)`,
        )
      }
    })

  return program
}
