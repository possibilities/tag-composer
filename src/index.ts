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

interface XmlNode {
  tag: string
  content: string[]
  children: XmlNode[]
}

interface ProcessingResult {
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
): ProcessingResult {
  if (node.type === 'Script') {
    let lastExitCode = 0
    node.commands.forEach((cmd: any) => {
      const result = processASTNode(
        cmd,
        buffer,
        undefined,
        false,
        isShebangMode,
        scriptPath,
      )
      lastExitCode = result.exitCode
    })
    return { exitCode: lastExitCode }
  }

  if (node.type === 'LogicalExpression') {
    const needsWrapper = !isNested
    if (needsWrapper) {
      buffer.addLine('<command>')
    }

    const leftResult = processASTNode(
      node.left,
      buffer,
      undefined,
      true,
      isShebangMode,
      scriptPath,
    )

    let finalExitCode = leftResult.exitCode

    if (node.op === 'and') {
      buffer.addLine('  <logical-and-operator />')
      if (leftResult.exitCode === 0) {
        const rightResult = processASTNode(
          node.right,
          buffer,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
        finalExitCode = rightResult.exitCode
      }
    } else if (node.op === 'or') {
      buffer.addLine('  <logical-or-operator />')
      if (leftResult.exitCode !== 0) {
        const rightResult = processASTNode(
          node.right,
          buffer,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
        finalExitCode = rightResult.exitCode
      }
    }

    if (needsWrapper) {
      buffer.addLine('</command>')
    }
    return { exitCode: finalExitCode }
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

    if (!isNested) {
      buffer.addLine('</command>')
    }
    return { exitCode: lastExitCode }
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
        return { exitCode: 1 }
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
        return { exitCode: 1 }
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
        return { exitCode: 0 }
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
      }
      return { exitCode: 1 }
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

    return { exitCode: result.exitCode }
  }

  // Default return for any unhandled cases
  return { exitCode: 0 }
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

function extractAndPromoteTags(
  node: XmlNode,
  tagNames: string[],
): { node: XmlNode; extracted: XmlNode[] } {
  const extracted: XmlNode[] = []

  const newChildren: XmlNode[] = []

  for (const child of node.children) {
    if (tagNames.includes(child.tag)) {
      extracted.push(child)
    } else {
      const result = extractAndPromoteTags(child, tagNames)
      newChildren.push(result.node)
      extracted.push(...result.extracted)
    }
  }

  return {
    node: { ...node, children: newChildren },
    extracted,
  }
}

function mergeSameTagNodes(nodes: XmlNode[]): XmlNode[] {
  const grouped = new Map<string, XmlNode[]>()

  for (const node of nodes) {
    if (!grouped.has(node.tag)) {
      grouped.set(node.tag, [])
    }
    grouped.get(node.tag)!.push(node)
  }

  const merged: XmlNode[] = []

  for (const [tag, sameTagNodes] of grouped) {
    if (sameTagNodes.length === 1) {
      merged.push(sameTagNodes[0])
    } else {
      const mergedContent: string[] = []
      const mergedChildren: XmlNode[] = []

      let hasContent = false
      for (const node of sameTagNodes) {
        if (node.content.length > 0) {
          hasContent = true
        }
        mergedContent.push(...node.content)
        mergedChildren.push(...node.children)
      }

      const mergedNode: XmlNode = {
        tag,
        content: mergedContent,
        children: mergeSameTagNodes(mergedChildren),
      }

      if (!hasContent && mergedNode.children.length > 0) {
        const childWithContent = mergedNode.children.find(
          child =>
            child.content.length > 0 ||
            (child.children.length === 1 &&
              child.children[0].content.length > 0),
        )
        if (childWithContent) {
          merged.push(mergedNode)
        } else {
          merged.push(...mergedNode.children)
        }
      } else {
        merged.push(mergedNode)
      }
    }
  }

  return merged
}

function flattenTree(root: XmlNode, tagsToPromote: string[]): XmlNode {
  const result = extractAndPromoteTags(root, tagsToPromote)

  const allChildren = [...result.node.children, ...result.extracted]

  return {
    ...result.node,
    children: mergeSameTagNodes(allChildren),
  }
}

function renderToXml(node: XmlNode, indent: string = ''): string[] {
  const lines: string[] = []

  if (node.tag) {
    lines.push(`${indent}<${node.tag}>`)
  }

  const childIndent = node.tag ? indent + '  ' : indent

  for (const contentLine of node.content) {
    lines.push(`${childIndent}${contentLine}`)
  }

  for (const child of node.children) {
    lines.push(...renderToXml(child, childIndent))
  }

  if (node.tag) {
    lines.push(`${indent}</${node.tag}>`)
  }

  return lines
}

function processCommandToXmlNode(
  node: any,
  isShebangMode: boolean,
  scriptPath?: string,
): XmlNode | null {
  if (node.type === 'Command' || node.type === 'SimpleCommand') {
    const isFs2xml = node.name?.text === 'fs-to-xml'

    if (isFs2xml) {
      const filePath = node.suffix?.[0]?.text
      if (!filePath) {
        if (!isShebangMode) {
          return {
            tag: 'fs-to-xml',
            content: [
              '<input>fs-to-xml</input>',
              '<stderr>Error: fs-to-xml requires a file path</stderr>',
              '<failure code="1" />',
            ],
            children: [],
          }
        } else {
          console.error('Error: fs-to-xml requires a file path')
          process.exit(1)
        }
      }

      const ext = extname(filePath)
      if (ext !== '.md') {
        if (!isShebangMode) {
          return {
            tag: 'fs-to-xml',
            content: [
              `<input>fs-to-xml ${filePath}</input>`,
              `<stderr>Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}</stderr>`,
              '<failure code="1" />',
            ],
            children: [],
          }
        } else {
          console.error(
            `Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}`,
          )
          process.exit(1)
        }
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
        const dirPath = dirname(resolvedPath)
        const pathParts = dirPath
          .split('/')
          .filter(part => part && part !== '.' && part !== '..')

        let currentNode: XmlNode = {
          tag: '',
          content: [],
          children: [],
        }

        let targetNode = currentNode

        for (const part of pathParts) {
          const childNode: XmlNode = {
            tag: part,
            content: [],
            children: [],
          }
          targetNode.children.push(childNode)
          targetNode = childNode
        }

        const lines = content.split('\n').filter(line => line.trim() !== '')
        targetNode.content = lines

        return currentNode.children[0] || null
      } catch (error: any) {
        if (!isShebangMode) {
          return {
            tag: 'fs-to-xml',
            content: [
              `<input>fs-to-xml ${filePath}</input>`,
              `<stderr>Error reading file: ${error.message}</stderr>`,
              '<failure code="1" />',
            ],
            children: [],
          }
        } else {
          console.error(`Error: fs-to-xml failed - ${error.message}`)
          process.exit(1)
        }
      }
    }
  }

  return null
}

function processMarkdownWithCommandsToXmlNodes(
  content: string,
  scriptPath?: string,
): { mainContent: string[]; siblingNodes: XmlNode[] } {
  const lines = content.split('\n')
  const mainContent: string[] = []
  const siblingNodes: XmlNode[] = []

  lines.forEach(line => {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      return
    }

    if (line.trim().startsWith('!!')) {
      const commandLine = line.trim().substring(2).trim()

      if (commandLine === '') {
        mainContent.push(line)
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

        const commandNode = ast.commands[0]
        if (commandNode?.name?.text === 'fs-to-xml') {
          const xmlNode = processCommandToXmlNode(commandNode, true, scriptPath)
          if (xmlNode) {
            siblingNodes.push(xmlNode)
          }
        } else {
          mainContent.push(line)
        }
      } catch (parseError: any) {
        console.error(`Error parsing markdown command: ${parseError.message}`)
        process.exit(1)
      }
    } else {
      mainContent.push(line)
    }
  })

  return { mainContent, siblingNodes }
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

          if (startsWithShebang) {
            const contentToProcess = lines.slice(1).join('\n')
            const result = processMarkdownWithCommandsToXmlNodes(
              contentToProcess,
              file,
            )

            let mainContentNode: XmlNode | null = null

            if (pathParts.length > 0) {
              mainContentNode = {
                tag: pathParts[0],
                content: [],
                children: [],
              }

              let targetNode = mainContentNode
              for (let i = 1; i < pathParts.length; i++) {
                const childNode: XmlNode = {
                  tag: pathParts[i],
                  content: [],
                  children: [],
                }
                targetNode.children.push(childNode)
                targetNode = childNode
              }

              targetNode.content = result.mainContent
            }

            const allNodes = mainContentNode
              ? [mainContentNode, ...result.siblingNodes]
              : result.siblingNodes

            const mergedRootNode: XmlNode = {
              tag: '',
              content: [],
              children: mergeSameTagNodes(allNodes),
            }

            const tagsToPromote = ['rules', 'roles', 'instructions', 'query']
            const flattened = flattenTree(mergedRootNode, tagsToPromote)

            const xmlLines = renderToXml(flattened)
            xmlLines.forEach(line => buffer.addLine(line))
          } else {
            let rootNode: XmlNode = {
              tag: '',
              content: [],
              children: [],
            }

            let targetNode = rootNode
            for (const part of pathParts) {
              const childNode: XmlNode = {
                tag: part,
                content: [],
                children: [],
              }
              targetNode.children.push(childNode)
              targetNode = childNode
            }

            const nonEmptyLines = content
              .split('\n')
              .filter(line => line.trim() !== '')
            targetNode.content = nonEmptyLines

            const xmlLines = renderToXml(rootNode)
            xmlLines.forEach(line => buffer.addLine(line))
          }

          buffer.flushAndFlatten(false)
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
