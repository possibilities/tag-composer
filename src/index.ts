import { Command } from 'commander'
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { basename, extname, dirname } from 'path'
import packageJson from '../package.json' assert { type: 'json' }
import parse from 'bash-parser'
import { validateAST } from './ast-validator.js'

interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

function executeCommand(command: string): CommandResult {
  const result = spawnSync('bash', ['-c', command], {
    encoding: 'utf8',
    shell: false,
  })

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  }
}

function processASTNode(
  node: any,
  commandText?: string,
  isNested = false,
): void {
  if (node.type === 'Script') {
    node.commands.forEach((cmd: any) => processASTNode(cmd))
    return
  }

  if (node.type === 'LogicalExpression') {
    const needsWrapper = !isNested
    if (needsWrapper) {
      console.log('<command>')
    }

    processASTNode(node.left, undefined, true)

    const lastExitCode = global.lastExitCode || 0

    if (node.op === 'and') {
      console.log('  <logical-and-operator />')
      if (lastExitCode === 0) {
        processASTNode(node.right, undefined, true)
      }
    } else if (node.op === 'or') {
      console.log('  <logical-or-operator />')
      if (lastExitCode !== 0) {
        processASTNode(node.right, undefined, true)
      }
    }

    if (needsWrapper) {
      console.log('</command>')
    }
    return
  }

  if (node.type === 'Pipeline') {
    if (!isNested) {
      console.log('<command>')
    }

    let lastOutput = ''
    let lastExitCode = 0

    node.commands.forEach((cmd: any, index: number) => {
      const isLast = index === node.commands.length - 1

      if (index === 0) {
        const isFs2xml = cmd.name?.text === 'fs-to-xml'
        const commandText = reconstructCommand(cmd, isFs2xml)
        const result = executeCommand(commandText)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text ? basename(cmd.name.text) : 'unknown'
        console.log(`  <${commandName}>`)
        const displayCommand = isFs2xml
          ? reconstructCommand(cmd, false)
          : commandText
        console.log(`    <input>${displayCommand}</input>`)

        const trimmedStderr = result.stderr.replace(/\n$/, '')
        if (trimmedStderr) {
          console.log(`    <stderr>${trimmedStderr}</stderr>`)
        }

        if (lastExitCode === 0) {
          console.log(`    <success code="0" />`)
        } else {
          console.log(`    <failure code="${lastExitCode}" />`)
        }
        console.log(`  </${commandName}>`)
      } else {
        console.log('  <pipe-operator />')

        const isFs2xml = cmd.name?.text === 'fs-to-xml'
        const commandText = reconstructCommand(cmd, isFs2xml)
        const pipeCommand = `echo '${lastOutput.replace(/'/g, "'\\''").replace(/\n$/, '')}' | ${commandText}`
        const result = executeCommand(pipeCommand)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text ? basename(cmd.name.text) : 'unknown'
        console.log(`  <${commandName}>`)
        const displayCommand = isFs2xml
          ? reconstructCommand(cmd, false)
          : commandText
        console.log(`    <input>${displayCommand}</input>`)
        if (isLast) {
          const trimmedOutput = lastOutput.replace(/\n$/, '')
          if (trimmedOutput === '') {
            console.log('    <stdout />')
          } else {
            console.log(`    <stdout>${trimmedOutput}</stdout>`)
          }
        }

        const trimmedStderr = result.stderr.replace(/\n$/, '')
        if (trimmedStderr) {
          console.log(`    <stderr>${trimmedStderr}</stderr>`)
        }

        if (lastExitCode === 0) {
          console.log(`    <success code="0" />`)
        } else {
          console.log(`    <failure code="${lastExitCode}" />`)
        }
        console.log(`  </${commandName}>`)
      }
    })

    global.lastExitCode = lastExitCode
    if (!isNested) {
      console.log('</command>')
    }
    return
  }

  if (node.type === 'Command' || node.type === 'SimpleCommand') {
    const isFs2xml = node.name?.text === 'fs-to-xml'

    if (!commandText) {
      commandText = reconstructCommand(node, isFs2xml)
    }

    const result = executeCommand(commandText)
    const commandName = node.name?.text ? basename(node.name.text) : 'unknown'

    console.log(`  <${commandName}>`)
    // For fs-to-xml, show the original command in input, not the transformed one
    const displayCommand = isFs2xml
      ? reconstructCommand(node, false)
      : commandText
    console.log(`    <input>${displayCommand}</input>`)

    const trimmedStdout = result.stdout.replace(/\n$/, '')
    if (trimmedStdout === '') {
      console.log('    <stdout />')
    } else {
      console.log(`    <stdout>${trimmedStdout}</stdout>`)
    }

    const trimmedStderr = result.stderr.replace(/\n$/, '')
    if (trimmedStderr) {
      console.log(`    <stderr>${trimmedStderr}</stderr>`)
    }

    if (result.exitCode === 0) {
      console.log(`    <success code="0" />`)
    } else {
      console.log(`    <failure code="${result.exitCode}" />`)
    }
    console.log(`  </${commandName}>`)

    global.lastExitCode = result.exitCode
  }
}

function reconstructCommand(node: any, transformFsToXml = false): string {
  const parts: string[] = []

  if (node.name?.text) {
    if (transformFsToXml && node.name.text === 'fs-to-xml') {
      // Replace fs-to-xml with the current executable
      // process.argv[0] is node, process.argv[1] is the CLI script path
      const cliPath = process.argv[1]
      if (cliPath && cliPath.endsWith('.js')) {
        // We're running the CLI directly
        parts.push(cliPath)
      } else {
        // We're running via shebang, need to find the actual CLI
        // The shebang line contains the path to the CLI
        parts.push('./dist/cli.js')
      }
      parts.push('--no-shebang')
    } else {
      parts.push(node.name.text)
    }
  }

  if (node.suffix) {
    node.suffix.forEach((item: any) => {
      if (item.text) {
        // Check if the text contains spaces or special characters that need quoting
        const text = item.text
        if (text.includes(' ') || text.includes('\n') || text.includes('\t')) {
          parts.push(`"${text}"`)
        } else {
          parts.push(text)
        }
      }
    })
  }

  return parts.join(' ')
}

declare global {
  var lastExitCode: number
}

async function main() {
  const program = new Command()

  program
    .name('fs-to-xml')
    .description('FS to XML CLI - A simple shebang interpreter')
    .version(packageJson.version)
    .argument('<file>', 'script file to process')
    .option(
      '--no-shebang',
      'Process file directly without shebang interpretation',
    )
    .action((file, options) => {
      try {
        // Handle --no-shebang mode for markdown files
        if (!options.shebang) {
          const ext = extname(file)
          if (ext !== '.md') {
            console.error(
              `Error: --no-shebang mode only supports .md files, got ${ext || 'no extension'}`,
            )
            process.exit(1)
          }

          const content = readFileSync(file, 'utf8')
          const dirPath = dirname(file)

          // Build XML structure from path
          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.')

          console.log('<command>')
          console.log('  <fs-to-xml>')
          console.log(`    <input>fs-to-xml ${file}</input>`)

          // Create nested XML tags
          let indent = '    '
          pathParts.forEach(part => {
            console.log(`${indent}<${part}>`)
            indent += '  '
          })

          // Output content
          console.log(`${indent}${content.replace(/\n$/, '')}`)

          // Close nested XML tags
          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            console.log(`${indent}</${pathParts[i]}>`)
          }

          console.log('    <success code="0" />')
          console.log('  </fs-to-xml>')
          console.log('</command>')
          return
        }

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

            if (
              ast.commands[0]?.type === 'LogicalExpression' ||
              ast.commands[0]?.type === 'Pipeline'
            ) {
              processASTNode(ast.commands[0])
            } else {
              console.log('<command>')
              // Don't pass line as commandText so that fs-to-xml can be transformed
              processASTNode(ast.commands[0])
              console.log('</command>')
            }
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
      error.code === 'commander.helpDisplayed' ||
      error.code === 'commander.version'
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
