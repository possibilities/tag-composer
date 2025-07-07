import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'
import { runPipeline } from './pipeline.js'

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

      const content = readFileSync(file, 'utf-8')
      const output = runPipeline(content, 'tag-composer')
      process.stdout.write(output)
    })

  return program
}
