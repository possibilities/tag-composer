import { Command } from 'commander'
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { basename, extname, dirname, join } from 'path'
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
  isShebangMode = false,
  scriptPath?: string,
): void {
  if (node.type === 'Script') {
    node.commands.forEach((cmd: any) =>
      processASTNode(cmd, undefined, false, isShebangMode, scriptPath),
    )
    return
  }

  if (node.type === 'LogicalExpression') {
    const needsWrapper = !isNested
    if (needsWrapper) {
      console.log('<command>')
    }

    processASTNode(node.left, undefined, true, isShebangMode, scriptPath)

    const lastExitCode = global.lastExitCode || 0

    if (node.op === 'and') {
      console.log('  <logical-and-operator />')
      if (lastExitCode === 0) {
        processASTNode(node.right, undefined, true, isShebangMode, scriptPath)
      }
    } else if (node.op === 'or') {
      console.log('  <logical-or-operator />')
      if (lastExitCode !== 0) {
        processASTNode(node.right, undefined, true, isShebangMode, scriptPath)
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
        const commandText = reconstructCommand(cmd)
        const result = executeCommand(commandText)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text ? basename(cmd.name.text) : 'unknown'
        console.log(`  <${commandName}>`)
        console.log(`    <input>${commandText}</input>`)

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

        const commandText = reconstructCommand(cmd)
        const pipeCommand = `echo '${lastOutput.replace(/'/g, "'\\''").replace(/\n$/, '')}' | ${commandText}`
        const result = executeCommand(pipeCommand)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text ? basename(cmd.name.text) : 'unknown'
        console.log(`  <${commandName}>`)
        console.log(`    <input>${commandText}</input>`)
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

    if (isFs2xml) {
      const filePath = node.suffix?.[0]?.text
      if (!filePath) {
        if (!isShebangMode) {
          console.log('  <fs-to-xml>')
          console.log('    <input>fs-to-xml</input>')
          console.log(
            '    <stderr>Error: fs-to-xml requires a file path</stderr>',
          )
          console.log('    <failure code="1" />')
          console.log('  </fs-to-xml>')
        } else {
          console.error('Error: fs-to-xml requires a file path')
          process.exit(1)
        }
        global.lastExitCode = 1
        return
      }

      const ext = extname(filePath)
      if (ext !== '.md') {
        if (!isShebangMode) {
          console.log('  <fs-to-xml>')
          console.log(`    <input>fs-to-xml ${filePath}</input>`)
          console.log(
            `    <stderr>Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}</stderr>`,
          )
          console.log('    <failure code="1" />')
          console.log('  </fs-to-xml>')
        } else {
          console.error(
            `Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}`,
          )
          process.exit(1)
        }
        global.lastExitCode = 1
        return
      }

      try {
        let resolvedPath = filePath
        if (isShebangMode && scriptPath) {
          if (filePath.startsWith('/')) {
            resolvedPath = filePath
          } else if (filePath.startsWith('.')) {
            resolvedPath = join(dirname(scriptPath), filePath)
          } else {
            resolvedPath = filePath
          }
        }

        const content = readFileSync(resolvedPath, 'utf8')
        const dirPath = dirname(filePath)

        if (isShebangMode) {
          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.')

          let indent = ''
          pathParts.forEach(part => {
            console.log(`${indent}<${part}>`)
            indent += '  '
          })

          console.log(`${indent}${content.replace(/\n$/, '')}`)

          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            console.log(`${indent}</${pathParts[i]}>`)
          }
        } else {
          console.log('  <fs-to-xml>')
          console.log(`    <input>fs-to-xml ${filePath}</input>`)

          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.')

          let indent = '    '
          pathParts.forEach(part => {
            console.log(`${indent}<${part}>`)
            indent += '  '
          })

          console.log(`${indent}${content.replace(/\n$/, '')}`)

          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            console.log(`${indent}</${pathParts[i]}>`)
          }

          console.log('    <success code="0" />')
          console.log('  </fs-to-xml>')
        }
        global.lastExitCode = 0
      } catch (error: any) {
        if (!isShebangMode) {
          console.log('  <fs-to-xml>')
          console.log(`    <input>fs-to-xml ${filePath}</input>`)
          console.log(
            `    <stderr>Error reading file: ${error.message}</stderr>`,
          )
          console.log('    <failure code="1" />')
          console.log('  </fs-to-xml>')
        } else {
          console.error(`Error: fs-to-xml failed - ${error.message}`)
          process.exit(1)
        }
        global.lastExitCode = 1
      }
      return
    }

    if (!commandText) {
      commandText = reconstructCommand(node)
    }

    const result = executeCommand(commandText)
    const commandName = node.name?.text ? basename(node.name.text) : 'unknown'

    console.log(`  <${commandName}>`)
    console.log(`    <input>${commandText}</input>`)

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

function reconstructCommand(node: any): string {
  const parts: string[] = []

  if (node.name?.text) {
    parts.push(node.name.text)
  }

  if (node.suffix) {
    node.suffix.forEach((item: any) => {
      if (item.text) {
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
    .action(file => {
      try {
        const ext = extname(file)

        if (ext === '.md') {
          const content = readFileSync(file, 'utf8')
          const dirPath = dirname(file)

          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.')

          let indent = ''
          pathParts.forEach(part => {
            console.log(`${indent}<${part}>`)
            indent += '  '
          })

          console.log(`${indent}${content.replace(/\n$/, '')}`)

          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            console.log(`${indent}</${pathParts[i]}>`)
          }
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
              processASTNode(
                ast.commands[0],
                undefined,
                false,
                startsWithShebang,
                file,
              )
            } else {
              const isFs2xmlCommand =
                ast.commands[0]?.name?.text === 'fs-to-xml'
              const shouldSkipWrapper = startsWithShebang && isFs2xmlCommand

              if (!shouldSkipWrapper) {
                console.log('<command>')
              }

              processASTNode(
                ast.commands[0],
                undefined,
                false,
                startsWithShebang,
                file,
              )

              if (!shouldSkipWrapper) {
                console.log('</command>')
              }
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
