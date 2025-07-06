import { Command } from 'commander'
import packageJson from '../package.json' assert { type: 'json' }
import { parseFs } from './parser.js'
import { renderToXml } from './renderer.js'

async function main() {
  const program = new Command()

  program
    .name('fs-to-xml')
    .description('FS to XML CLI')
    .version(packageJson.version)
    .option('--no-flatten', 'disable flattening')
    .option('--json', 'return JSON')
    .argument('<file>', 'file to interpret')
    .action((file, options) => {
      try {
        const parsedFsInfo = parseFs(file, options)

        if (options.json) {
          console.log(JSON.stringify(parsedFsInfo, null, 2))
          process.exit(0)
        }

        const xmlString = renderToXml(parsedFsInfo, options)
        console.log(xmlString)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  try {
    program.exitOverride()
    program.configureOutput({
      writeErr: str => process.stderr.write(str),
    })

    await program.parseAsync(process.argv)
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (
      err.code === 'commander.help' ||
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.version'
    ) {
      process.exit(0)
    }
    console.error('Error:', err.message || error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })
}
