import { Command } from 'commander'
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
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
        const commandText = reconstructCommand(cmd)
        const result = executeCommand(commandText)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text || 'unknown'
        console.log(`  <${commandName}>`)
        console.log(`    <input>${commandText}</input>`)

        const trimmedStderr = result.stderr.replace(/\n$/, '')
        if (trimmedStderr) {
          console.log(`    <stderr>${trimmedStderr}</stderr>`)
        }

        console.log(`    <exit>${lastExitCode}</exit>`)
        console.log(`  </${commandName}>`)
      } else {
        console.log('  <pipe-operator />')

        const commandText = reconstructCommand(cmd)
        const pipeCommand = `echo '${lastOutput.replace(/'/g, "'\\''").replace(/\n$/, '')}' | ${commandText}`
        const result = executeCommand(pipeCommand)
        lastOutput = result.stdout
        lastExitCode = result.exitCode

        const commandName = cmd.name?.text || 'unknown'
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

        console.log(`    <exit>${lastExitCode}</exit>`)
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
    if (!commandText) {
      commandText = reconstructCommand(node)
    }

    const result = executeCommand(commandText)
    const commandName = node.name?.text || 'unknown'

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

    console.log(`    <exit>${result.exitCode}</exit>`)
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

            if (
              ast.commands[0]?.type === 'LogicalExpression' ||
              ast.commands[0]?.type === 'Pipeline'
            ) {
              processASTNode(ast.commands[0])
            } else {
              console.log('<command>')
              processASTNode(ast.commands[0], line)
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
