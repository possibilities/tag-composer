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

class OutputBuffer {
  private lines: string[] = []

  addLine(line: string): void {
    this.lines.push(line)
  }

  getLines(): string[] {
    return this.lines
  }

  flushAndFlatten(flatten: boolean): void {
    if (flatten) {
      const flattened = this.flattenConsecutiveTags(this.lines)
      flattened.forEach(line => console.log(line))
    } else {
      this.lines.forEach(line => console.log(line))
    }
  }

  private flattenConsecutiveTags(lines: string[]): string[] {
    const result: string[] = []
    let i = 0

    while (i < lines.length) {
      const currentLine = lines[i]
      const openTagMatch = currentLine.match(/^(\s*)<([^/>]+)>$/)

      if (openTagMatch) {
        const indent = openTagMatch[1]
        const tagName = openTagMatch[2]
        const collectedContent: string[] = []
        let j = i

        while (j < lines.length) {
          const checkLine = lines[j]
          const checkOpenMatch = checkLine.match(/^(\s*)<([^/>]+)>$/)

          if (
            checkOpenMatch &&
            checkOpenMatch[1] === indent &&
            checkOpenMatch[2] === tagName
          ) {
            j++
            const contentStartIndex = j

            while (
              j < lines.length &&
              !lines[j].match(new RegExp(`^${indent}</${tagName}>$`))
            ) {
              j++
            }

            if (j < lines.length) {
              for (let k = contentStartIndex; k < j; k++) {
                collectedContent.push(lines[k])
              }
              j++
            } else {
              break
            }
          } else {
            break
          }
        }

        if (collectedContent.length > 0) {
          result.push(`${indent}<${tagName}>`)
          collectedContent.forEach(line => result.push(line))
          result.push(`${indent}</${tagName}>`)
          i = j
        } else {
          result.push(currentLine)
          i++
        }
      } else {
        result.push(currentLine)
        i++
      }
    }

    return result
  }
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
  buffer: OutputBuffer,
  commandText?: string,
  isNested = false,
  isShebangMode = false,
  scriptPath?: string,
): void {
  if (node.type === 'Script') {
    node.commands.forEach((cmd: any) =>
      processASTNode(cmd, buffer, undefined, false, isShebangMode, scriptPath),
    )
    return
  }

  if (node.type === 'LogicalExpression') {
    const needsWrapper = !isNested
    if (needsWrapper) {
      buffer.addLine('<command>')
    }

    processASTNode(
      node.left,
      buffer,
      undefined,
      true,
      isShebangMode,
      scriptPath,
    )

    const lastExitCode = global.lastExitCode || 0

    if (node.op === 'and') {
      buffer.addLine('  <logical-and-operator />')
      if (lastExitCode === 0) {
        processASTNode(
          node.right,
          buffer,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
      }
    } else if (node.op === 'or') {
      buffer.addLine('  <logical-or-operator />')
      if (lastExitCode !== 0) {
        processASTNode(
          node.right,
          buffer,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
      }
    }

    if (needsWrapper) {
      buffer.addLine('</command>')
    }
    return
  }

  if (node.type === 'Pipeline') {
    if (!isNested) {
      buffer.addLine('<command>')
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
        buffer.addLine(`  <${commandName}>`)
        buffer.addLine(`    <input>${commandText}</input>`)

        const trimmedStderr = result.stderr.replace(/\n$/, '')
        if (trimmedStderr) {
          buffer.addLine(`    <stderr>${trimmedStderr}</stderr>`)
        }

        if (lastExitCode === 0) {
          buffer.addLine(`    <success code="0" />`)
        } else {
          buffer.addLine(`    <failure code="${lastExitCode}" />`)
        }
        buffer.addLine(`  </${commandName}>`)
      } else {
        buffer.addLine('  <pipe-operator />')

        const commandText = reconstructCommand(cmd)
        const pipeCommand = `echo '${lastOutput.replace(/'/g, "'\\''").replace(/\n$/, '')}' | ${commandText}`
        const result = executeCommand(pipeCommand)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text ? basename(cmd.name.text) : 'unknown'
        buffer.addLine(`  <${commandName}>`)
        buffer.addLine(`    <input>${commandText}</input>`)
        if (isLast) {
          const trimmedOutput = lastOutput.replace(/\n$/, '')
          if (trimmedOutput === '') {
            buffer.addLine('    <stdout />')
          } else {
            buffer.addLine(`    <stdout>${trimmedOutput}</stdout>`)
          }
        }

        const trimmedStderr = result.stderr.replace(/\n$/, '')
        if (trimmedStderr) {
          buffer.addLine(`    <stderr>${trimmedStderr}</stderr>`)
        }

        if (lastExitCode === 0) {
          buffer.addLine(`    <success code="0" />`)
        } else {
          buffer.addLine(`    <failure code="${lastExitCode}" />`)
        }
        buffer.addLine(`  </${commandName}>`)
      }
    })

    global.lastExitCode = lastExitCode
    if (!isNested) {
      buffer.addLine('</command>')
    }
    return
  }

  if (node.type === 'Command' || node.type === 'SimpleCommand') {
    const isFs2xml = node.name?.text === 'fs-to-xml'

    if (isFs2xml) {
      const filePath = node.suffix?.[0]?.text
      if (!filePath) {
        if (!isShebangMode) {
          buffer.addLine('  <fs-to-xml>')
          buffer.addLine('    <input>fs-to-xml</input>')
          buffer.addLine(
            '    <stderr>Error: fs-to-xml requires a file path</stderr>',
          )
          buffer.addLine('    <failure code="1" />')
          buffer.addLine('  </fs-to-xml>')
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
          buffer.addLine('  <fs-to-xml>')
          buffer.addLine(`    <input>fs-to-xml ${filePath}</input>`)
          buffer.addLine(
            `    <stderr>Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}</stderr>`,
          )
          buffer.addLine('    <failure code="1" />')
          buffer.addLine('  </fs-to-xml>')
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
            .filter(part => part && part !== '.' && part !== '..')

          let indent = ''
          pathParts.forEach(part => {
            buffer.addLine(`${indent}<${part}>`)
            indent += '  '
          })

          const tempBuffer = new OutputBuffer()
          processMarkdownWithCommands(content, indent, tempBuffer, scriptPath)

          const lines = tempBuffer.getLines()
          lines.forEach(line => {
            buffer.addLine(line)
          })

          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            buffer.addLine(`${indent}</${pathParts[i]}>`)
          }
        } else {
          buffer.addLine('  <fs-to-xml>')
          buffer.addLine(`    <input>fs-to-xml ${filePath}</input>`)

          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.' && part !== '..')

          let indent = '    '
          pathParts.forEach(part => {
            buffer.addLine(`${indent}<${part}>`)
            indent += '  '
          })

          buffer.addLine(indentMultilineContent(content, indent))

          for (let i = pathParts.length - 1; i >= 0; i--) {
            indent = indent.slice(0, -2)
            buffer.addLine(`${indent}</${pathParts[i]}>`)
          }

          buffer.addLine('    <success code="0" />')
          buffer.addLine('  </fs-to-xml>')
        }
        global.lastExitCode = 0
      } catch (error: any) {
        if (!isShebangMode) {
          buffer.addLine('  <fs-to-xml>')
          buffer.addLine(`    <input>fs-to-xml ${filePath}</input>`)
          buffer.addLine(
            `    <stderr>Error reading file: ${error.message}</stderr>`,
          )
          buffer.addLine('    <failure code="1" />')
          buffer.addLine('  </fs-to-xml>')
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

    buffer.addLine(`  <${commandName}>`)
    buffer.addLine(`    <input>${commandText}</input>`)

    const trimmedStdout = result.stdout.replace(/\n$/, '')
    if (trimmedStdout === '') {
      buffer.addLine('    <stdout />')
    } else {
      buffer.addLine(`    <stdout>${trimmedStdout}</stdout>`)
    }

    const trimmedStderr = result.stderr.replace(/\n$/, '')
    if (trimmedStderr) {
      buffer.addLine(`    <stderr>${trimmedStderr}</stderr>`)
    }

    if (result.exitCode === 0) {
      buffer.addLine(`    <success code="0" />`)
    } else {
      buffer.addLine(`    <failure code="${result.exitCode}" />`)
    }
    buffer.addLine(`  </${commandName}>`)

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

function indentMultilineContent(content: string, indent: string): string {
  const trimmedContent = content.replace(/\n$/, '')
  const lines = trimmedContent.split('\n')
  const nonEmptyLines = lines.filter(line => line.trim() !== '')
  return nonEmptyLines.map(line => `${indent}${line}`).join('\n')
}

interface ProcessMarkdownResult {
  contentBuffer: OutputBuffer
  siblingBuffers: OutputBuffer[]
}

function processMarkdownWithCommands(
  content: string,
  indent: string,
  buffer: OutputBuffer,
  scriptPath?: string,
): void {
  const lines = content.split('\n')

  lines.forEach(line => {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      return
    }

    if (line.trim().startsWith('!!')) {
      const commandLine = line.trim().substring(2).trim()

      if (commandLine === '') {
        buffer.addLine(`${indent}${line}`)
        return
      }

      try {
        const ast = parse(commandLine)

        try {
          validateAST(ast)
        } catch (validationError: any) {
          console.error(
            `Validation error in markdown command: ${validationError.message}`,
          )
          process.exit(1)
        }

        const originalBuffer = new OutputBuffer()

        if (
          ast.commands[0]?.type === 'LogicalExpression' ||
          ast.commands[0]?.type === 'Pipeline'
        ) {
          processASTNode(
            ast.commands[0],
            originalBuffer,
            undefined,
            false,
            true,
            scriptPath,
          )
        } else {
          const isFs2xmlCommand = ast.commands[0]?.name?.text === 'fs-to-xml'
          const shouldSkipWrapper = isFs2xmlCommand

          if (!shouldSkipWrapper) {
            originalBuffer.addLine('<command>')
          }

          processASTNode(
            ast.commands[0],
            originalBuffer,
            undefined,
            false,
            true,
            scriptPath,
          )

          if (!shouldSkipWrapper) {
            originalBuffer.addLine('</command>')
          }
        }

        const outputLines = originalBuffer.getLines()
        outputLines.forEach(outputLine => {
          buffer.addLine(`${indent}${outputLine}`)
        })
      } catch (parseError: any) {
        console.error(`Error parsing markdown command: ${parseError.message}`)
        process.exit(1)
      }
    } else {
      buffer.addLine(`${indent}${line}`)
    }
  })
}

function processMarkdownWithCommandsForShebang(
  content: string,
  indent: string,
  scriptPath?: string,
): ProcessMarkdownResult {
  const lines = content.split('\n')
  const contentBuffer = new OutputBuffer()
  const siblingBuffers: OutputBuffer[] = []

  lines.forEach(line => {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      return
    }

    if (line.trim().startsWith('!!')) {
      const commandLine = line.trim().substring(2).trim()

      if (commandLine === '') {
        contentBuffer.addLine(`${indent}${line}`)
        return
      }

      try {
        const ast = parse(commandLine)

        try {
          validateAST(ast)
        } catch (validationError: any) {
          console.error(
            `Validation error in markdown command: ${validationError.message}`,
          )
          process.exit(1)
        }

        const originalBuffer = new OutputBuffer()

        if (
          ast.commands[0]?.type === 'LogicalExpression' ||
          ast.commands[0]?.type === 'Pipeline'
        ) {
          processASTNode(
            ast.commands[0],
            originalBuffer,
            undefined,
            false,
            true,
            scriptPath,
          )
        } else {
          const isFs2xmlCommand = ast.commands[0]?.name?.text === 'fs-to-xml'
          const shouldSkipWrapper = isFs2xmlCommand

          if (!shouldSkipWrapper) {
            originalBuffer.addLine('<command>')
          }

          processASTNode(
            ast.commands[0],
            originalBuffer,
            undefined,
            false,
            true,
            scriptPath,
          )

          if (!shouldSkipWrapper) {
            originalBuffer.addLine('</command>')
          }
        }

        if (ast.commands[0]?.name?.text === 'fs-to-xml') {
          siblingBuffers.push(originalBuffer)
        } else {
          const outputLines = originalBuffer.getLines()
          outputLines.forEach(outputLine => {
            contentBuffer.addLine(`${indent}${outputLine}`)
          })
        }
      } catch (parseError: any) {
        console.error(`Error parsing markdown command: ${parseError.message}`)
        process.exit(1)
      }
    } else {
      contentBuffer.addLine(`${indent}${line}`)
    }
  })

  return { contentBuffer, siblingBuffers }
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
    .option('--no-flatten', 'disable flattening of consecutive same-named tags')
    .argument('<file>', 'script file to process')
    .action((file, options) => {
      const buffer = new OutputBuffer()
      const flatten = options.flatten !== false

      try {
        const ext = extname(file)

        if (ext === '.md') {
          const content = readFileSync(file, 'utf8')
          const lines = content.split('\n')
          const firstLine = lines[0]
          const startsWithShebang = firstLine.startsWith('#!')

          const dirPath = dirname(file)
          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.' && part !== '..')

          let indent = ''
          pathParts.forEach(part => {
            buffer.addLine(`${indent}<${part}>`)
            indent += '  '
          })

          if (startsWithShebang) {
            const contentToProcess = lines.slice(1).join('\n')
            const result = processMarkdownWithCommandsForShebang(
              contentToProcess,
              indent,
              file,
            )

            const contentLines = result.contentBuffer.getLines()
            contentLines.forEach(line => {
              buffer.addLine(line)
            })

            for (let i = pathParts.length - 1; i >= 0; i--) {
              indent = indent.slice(0, -2)
              buffer.addLine(`${indent}</${pathParts[i]}>`)
            }

            const parentIndent = indent
            result.siblingBuffers.forEach(siblingBuffer => {
              const siblingLines = siblingBuffer.getLines()
              siblingLines.forEach(line => {
                buffer.addLine(`${parentIndent}${line}`)
              })
            })
          } else {
            buffer.addLine(indentMultilineContent(content, indent))

            for (let i = pathParts.length - 1; i >= 0; i--) {
              indent = indent.slice(0, -2)
              buffer.addLine(`${indent}</${pathParts[i]}>`)
            }
          }

          buffer.flushAndFlatten(flatten)
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
                buffer,
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
                buffer.addLine('<command>')
              }

              processASTNode(
                ast.commands[0],
                buffer,
                undefined,
                false,
                startsWithShebang,
                file,
              )

              if (!shouldSkipWrapper) {
                buffer.addLine('</command>')
              }
            }
          } catch (parseError: any) {
            console.error(
              `Error parsing line ${index + 1}: ${parseError.message}`,
            )
            process.exit(1)
          }
        })

        buffer.flushAndFlatten(flatten)
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
