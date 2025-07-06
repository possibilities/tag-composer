import { Command } from 'commander'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import packageJson from '../package.json' assert { type: 'json' }
import parse from 'bash-parser'
import { validateAST } from './ast-validator.js'

async function main() {
  const program = new Command()

  program
    .name('fs-to-xml')
    .description('FS to XML CLI - A simple shebang interpreter')
    .version(packageJson.version)
    .argument('<file>', 'script file to process')
    .action(file => {
      try {
        const content = readFileSync(file, 'utf8')
        const lines = content.split('\n')

        const firstLine = lines[0]
        const startsWithShebang = firstLine.startsWith('#!')

        const linesToProcess = startsWithShebang ? lines.slice(1) : lines

        linesToProcess.forEach((line, index) => {
          const trimmedLine = line.trim()

          if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            return
          }

          try {
            const ast = parse(line)

            try {
              validateAST(ast)
            } catch (validationError: any) {
              console.error(
                `Validation error on line ${index + 1}: ${validationError.message}`,
              )
              process.exit(1)
            }

            const commandName = ast.commands[0]?.name?.text || 'unknown'

            const output = execSync(line, { encoding: 'utf8' })
            const trimmedOutput = output.replace(/\n$/, '')

            console.log('<command>')
            console.log(`  <${commandName}>`)
            console.log(`    <input>${line}</input>`)
            if (trimmedOutput === '') {
              console.log(`    <output-is-empty />`)
            } else {
              console.log(`    <output>${trimmedOutput}</output>`)
            }
            console.log(`  </${commandName}>`)
            console.log('</command>')
          } catch (parseError: any) {
            console.error(
              `Error parsing line ${index + 1}: ${parseError.message}`,
            )
            process.exit(1)
          }
        })
      } catch (error: any) {
        console.error(`Error reading file '${file}':`, error.message)
        process.exit(1)
      }
    })

  try {
    program.exitOverride()
    program.configureOutput({
      writeErr: str => process.stderr.write(str),
    })

    await program.parseAsync(process.argv)
  } catch (error: any) {
    if (
      error.code === 'commander.help' ||
      error.code === 'commander.helpDisplayed'
    ) {
      process.exit(0)
    }
    console.error('Error:', error.message || error)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
