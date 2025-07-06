import { Command } from 'commander'
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { basename, extname, dirname, join } from 'path'
import packageJson from '../package.json' assert { type: 'json' }
import parse from 'bash-parser'

interface ParseResult {
  type: 'Script'
  commands: ASTNode[]
}
import { validateAST } from './ast-validator.js'

interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface ParsedCommand {
  type: 'command'
  commandName: string
  input: string
  stdout: string
  stderr: string
  exitCode: number
  hiddenStdout?: boolean
  extraChildren?: ParsedNode[]
  fs2xmlNonShebang?: boolean
}

interface ParsedOperator {
  type: 'logical-and-operator' | 'logical-or-operator' | 'pipe-operator'
}

interface ParsedWrapper {
  type: 'wrapper'
  tag: string
  children: ParsedNode[]
}

interface ParsedContent {
  type: 'content'
  lines: string[]
}

interface ParsedDirectory {
  type: 'directory'
  name: string
  children: ParsedNode[]
}

interface ParsedEmptyTag {
  type: 'empty-tag'
  tag: string
}

type ParsedNode =
  | ParsedCommand
  | ParsedOperator
  | ParsedWrapper
  | ParsedContent
  | ParsedDirectory
  | ParsedEmptyTag

interface ParsedFsInfo {
  nodes: ParsedNode[]
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

function reconstructCommand(node: ASTNode): string {
  const parts: string[] = []

  if (node.name?.text) {
    parts.push(node.name.text)
  }

  if (node.suffix) {
    node.suffix.forEach(item => {
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

interface ASTNode {
  type: string
  commands?: ASTNode[]
  left?: ASTNode
  right?: ASTNode
  op?: 'and' | 'or'
  name?: { text?: string }
  suffix?: Array<{ text?: string }>
}

function parseASTNode(
  node: ASTNode,
  commandText?: string,
  isNested = false,
  isShebangMode = false,
  scriptPath?: string,
): { nodes: ParsedNode[]; exitCode: number } {
  if (node.type === 'Script') {
    const allNodes: ParsedNode[] = []
    let lastExitCode = 0

    if (node.commands) {
      node.commands.forEach(cmd => {
        const result = parseASTNode(
          cmd,
          undefined,
          false,
          isShebangMode,
          scriptPath,
        )
        allNodes.push(...result.nodes)
        lastExitCode = result.exitCode
      })
    }

    return { nodes: allNodes, exitCode: lastExitCode }
  }

  if (node.type === 'LogicalExpression') {
    const nodes: ParsedNode[] = []
    const childNodes: ParsedNode[] = []

    const leftResult = parseASTNode(
      node.left!,
      undefined,
      true,
      isShebangMode,
      scriptPath,
    )
    childNodes.push(...leftResult.nodes)

    let finalExitCode = leftResult.exitCode

    if (node.op === 'and') {
      childNodes.push({ type: 'logical-and-operator' })
      if (leftResult.exitCode === 0) {
        const rightResult = parseASTNode(
          node.right!,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
        childNodes.push(...rightResult.nodes)
        finalExitCode = rightResult.exitCode
      }
    } else if (node.op === 'or') {
      childNodes.push({ type: 'logical-or-operator' })
      if (leftResult.exitCode !== 0) {
        const rightResult = parseASTNode(
          node.right!,
          undefined,
          true,
          isShebangMode,
          scriptPath,
        )
        childNodes.push(...rightResult.nodes)
        finalExitCode = rightResult.exitCode
      }
    }

    if (!isNested) {
      nodes.push({ type: 'wrapper', tag: 'command', children: childNodes })
    } else {
      nodes.push(...childNodes)
    }

    return { nodes, exitCode: finalExitCode }
  }

  if (node.type === 'Pipeline') {
    const childNodes: ParsedNode[] = []
    let lastOutput = ''
    let lastExitCode = 0

    if (node.commands) {
      const commands = node.commands
      commands.forEach((cmd, index) => {
        const isLast = index === commands.length - 1

        if (index === 0) {
          const commandText = reconstructCommand(cmd)
          const result = executeCommand(commandText)
          lastOutput = result.stdout
          lastExitCode = result.exitCode

          const commandName = cmd.name?.text
            ? basename(cmd.name.text)
            : 'unknown'
          childNodes.push({
            type: 'command',
            commandName,
            input: commandText,
            stdout: '',
            stderr: result.stderr.replace(/\n$/, ''),
            exitCode: result.exitCode,
            hiddenStdout: true,
          })
        } else {
          childNodes.push({ type: 'pipe-operator' })

          const commandText = reconstructCommand(cmd)
          const pipeCommand = `echo '${lastOutput.replace(/'/g, "'\\''").replace(/\n$/, '')}' | ${commandText}`
          const result = executeCommand(pipeCommand)
          lastOutput = result.stdout
          lastExitCode = result.exitCode

          const commandName = cmd.name?.text
            ? basename(cmd.name.text)
            : 'unknown'
          childNodes.push({
            type: 'command',
            commandName,
            input: commandText,
            stdout: isLast ? result.stdout.replace(/\n$/, '') : '',
            stderr: result.stderr.replace(/\n$/, ''),
            exitCode: result.exitCode,
          })
        }
      })
    }

    if (!isNested) {
      return {
        nodes: [{ type: 'wrapper', tag: 'command', children: childNodes }],
        exitCode: lastExitCode,
      }
    } else {
      return { nodes: childNodes, exitCode: lastExitCode }
    }
  }

  if (node.type === 'Command' || node.type === 'SimpleCommand') {
    const isFs2xml = node.name?.text === 'fs-to-xml'

    if (isFs2xml) {
      const filePath = node.suffix?.[0]?.text
      if (!filePath) {
        if (!isShebangMode) {
          return {
            nodes: [
              {
                type: 'command',
                commandName: 'fs-to-xml',
                input: 'fs-to-xml',
                stdout: '',
                stderr: 'Error: fs-to-xml requires a file path',
                exitCode: 1,
              },
            ],
            exitCode: 1,
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
            nodes: [
              {
                type: 'command',
                commandName: 'fs-to-xml',
                input: `fs-to-xml ${filePath}`,
                stdout: '',
                stderr: `Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}`,
                exitCode: 1,
              },
            ],
            exitCode: 1,
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
        const dirPath = dirname(filePath)

        if (isShebangMode) {
          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.' && part !== '..')

          let currentNode: ParsedDirectory | null = null
          let targetNode: ParsedDirectory | null = null

          for (const part of pathParts) {
            const newNode: ParsedDirectory = {
              type: 'directory',
              name: part,
              children: [],
            }

            if (!currentNode) {
              currentNode = newNode
              targetNode = newNode
            } else {
              targetNode!.children.push(newNode)
              targetNode = newNode
            }
          }

          const parsedContent = parseMarkdownWithCommands(content, scriptPath)
          if (targetNode) {
            targetNode.children.push(...parsedContent.nodes)
          }

          return {
            nodes: currentNode ? [currentNode] : parsedContent.nodes,
            exitCode: 0,
          }
        } else {
          const pathParts = dirPath
            .split('/')
            .filter(part => part && part !== '.' && part !== '..')

          let currentNode: ParsedDirectory | null = null
          let targetNode: ParsedDirectory | null = null

          for (const part of pathParts) {
            const newNode: ParsedDirectory = {
              type: 'directory',
              name: part,
              children: [],
            }

            if (!currentNode) {
              currentNode = newNode
              targetNode = newNode
            } else {
              targetNode!.children.push(newNode)
              targetNode = newNode
            }
          }

          const lines = content.split('\n').filter(line => line.trim() !== '')
          const contentNode: ParsedContent = {
            type: 'content',
            lines,
          }

          if (targetNode) {
            targetNode.children.push(contentNode)
          }

          return {
            nodes: [
              {
                type: 'command',
                commandName: 'fs-to-xml',
                input: `fs-to-xml ${filePath}`,
                stdout: '',
                stderr: '',
                exitCode: 0,
                extraChildren: currentNode ? [currentNode] : [contentNode],
                fs2xmlNonShebang: true,
              },
            ],
            exitCode: 0,
          }
        }
      } catch (error) {
        if (!isShebangMode) {
          return {
            nodes: [
              {
                type: 'command',
                commandName: 'fs-to-xml',
                input: `fs-to-xml ${filePath}`,
                stdout: '',
                stderr: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
                exitCode: 1,
              },
            ],
            exitCode: 1,
          }
        } else {
          console.error(
            `Error: fs-to-xml failed - ${error instanceof Error ? error.message : String(error)}`,
          )
          process.exit(1)
        }
      }
    }

    if (!commandText) {
      commandText = reconstructCommand(node)
    }

    const result = executeCommand(commandText)
    const commandName = node.name?.text ? basename(node.name.text) : 'unknown'

    return {
      nodes: [
        {
          type: 'command',
          commandName,
          input: commandText,
          stdout: result.stdout.replace(/\n$/, ''),
          stderr: result.stderr.replace(/\n$/, ''),
          exitCode: result.exitCode,
        },
      ],
      exitCode: result.exitCode,
    }
  }

  return { nodes: [], exitCode: 0 }
}

function parseMarkdownWithCommands(
  content: string,
  scriptPath?: string,
): { nodes: ParsedNode[] } {
  const lines = content.split('\n')
  const nodes: ParsedNode[] = []
  const contentLines: string[] = []

  const flushContent = () => {
    if (contentLines.length > 0) {
      nodes.push({
        type: 'content',
        lines: [...contentLines],
      })
      contentLines.length = 0
    }
  }

  lines.forEach(line => {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      return
    }

    if (line.trim().startsWith('!!')) {
      const commandLine = line.trim().substring(2).trim()

      if (commandLine === '') {
        contentLines.push(line)
        return
      }

      try {
        const ast = parse(commandLine) as ParseResult

        try {
          validateAST(ast)
        } catch (validationError) {
          console.error(
            `Validation error in markdown command: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          )
          process.exit(1)
        }

        flushContent()

        const commandNode = ast.commands[0]
        if (commandNode?.name?.text === 'fs-to-xml') {
          const result = parseASTNode(
            commandNode,
            undefined,
            false,
            true,
            scriptPath,
          )
          nodes.push(...result.nodes)
        } else {
          if (
            commandNode?.type === 'LogicalExpression' ||
            commandNode?.type === 'Pipeline'
          ) {
            const result = parseASTNode(
              commandNode,
              undefined,
              false,
              true,
              scriptPath,
            )
            nodes.push(...result.nodes)
          } else {
            const result = parseASTNode(
              commandNode,
              undefined,
              false,
              true,
              scriptPath,
            )
            nodes.push({
              type: 'wrapper',
              tag: 'command',
              children: result.nodes,
            })
          }
        }
      } catch (parseError) {
        console.error(
          `Error parsing markdown command: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
        process.exit(1)
      }
    } else {
      contentLines.push(line)
    }
  })

  flushContent()
  return { nodes }
}

function parseMarkdownWithCommandsToXmlNodes(
  content: string,
  scriptPath?: string,
): { mainContent: string[]; siblingNodes: ParsedNode[] } {
  const lines = content.split('\n')
  const mainContent: string[] = []
  const siblingNodes: ParsedNode[] = []

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
        const ast = parse(commandLine) as ParseResult

        try {
          validateAST(ast)
        } catch (validationError) {
          console.error(
            `Validation error in markdown command: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          )
          process.exit(1)
        }

        const commandNode = ast.commands[0]
        if (commandNode?.name?.text === 'fs-to-xml') {
          const result = parseASTNode(
            commandNode,
            undefined,
            false,
            true,
            scriptPath,
          )
          siblingNodes.push(...result.nodes)
        } else {
          mainContent.push(line)
        }
      } catch (parseError) {
        console.error(
          `Error parsing markdown command: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
        process.exit(1)
      }
    } else {
      mainContent.push(line)
    }
  })

  return { mainContent, siblingNodes }
}

function mergeSameTagNodes(nodes: ParsedNode[]): ParsedNode[] {
  const grouped = new Map<string, ParsedDirectory[]>()

  for (const node of nodes) {
    if (node.type === 'directory') {
      if (!grouped.has(node.name)) {
        grouped.set(node.name, [])
      }
      grouped.get(node.name)!.push(node)
    }
  }

  const merged: ParsedNode[] = []

  for (const node of nodes) {
    if (node.type !== 'directory') {
      merged.push(node)
      continue
    }

    const sameTagNodes = grouped.get(node.name)!
    if (sameTagNodes.length === 1) {
      merged.push(node)
    } else {
      const firstIndex = nodes.indexOf(sameTagNodes[0])
      if (nodes.indexOf(node) === firstIndex) {
        const mergedChildren: ParsedNode[] = []
        for (const dirNode of sameTagNodes) {
          mergedChildren.push(...dirNode.children)
        }

        merged.push({
          type: 'directory',
          name: node.name,
          children: mergeSameTagNodes(mergedChildren),
        })
      }
    }
  }

  return merged
}

interface Options {
  flatten?: boolean
}

function parseFs(file: string, _options: Options): ParsedFsInfo {
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
        const result = parseMarkdownWithCommandsToXmlNodes(
          contentToProcess,
          file,
        )

        let mainContentNode: ParsedDirectory | null = null

        if (pathParts.length > 0) {
          mainContentNode = {
            type: 'directory',
            name: pathParts[0],
            children: [],
          }

          let targetNode = mainContentNode
          for (let i = 1; i < pathParts.length; i++) {
            const childNode: ParsedDirectory = {
              type: 'directory',
              name: pathParts[i],
              children: [],
            }
            targetNode.children.push(childNode)
            targetNode = childNode
          }

          if (result.mainContent.length > 0) {
            targetNode.children.push({
              type: 'content',
              lines: result.mainContent,
            })
          }
        }

        const allNodes = mainContentNode
          ? [mainContentNode, ...result.siblingNodes]
          : result.siblingNodes
        const mergedNodes = mergeSameTagNodes(allNodes)

        const promoted = promoteSpecialTags(mergedNodes, [
          'rules',
          'roles',
          'instructions',
          'query',
        ])
        return { nodes: promoted }
      } else {
        let rootNode: ParsedDirectory | null = null
        let targetNode: ParsedDirectory | null = null

        for (const part of pathParts) {
          const childNode: ParsedDirectory = {
            type: 'directory',
            name: part,
            children: [],
          }

          if (!rootNode) {
            rootNode = childNode
            targetNode = childNode
          } else {
            targetNode!.children.push(childNode)
            targetNode = childNode
          }
        }

        const nonEmptyLines = content
          .split('\n')
          .filter(line => line.trim() !== '')
        if (targetNode && nonEmptyLines.length > 0) {
          targetNode.children.push({
            type: 'content',
            lines: nonEmptyLines,
          })
        }

        return { nodes: rootNode ? [rootNode] : [] }
      }
    }

    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')

    const firstLine = lines[0]
    const startsWithShebang = firstLine.startsWith('#!')

    const linesToProcess = startsWithShebang ? lines.slice(1) : lines
    const nodes: ParsedNode[] = []

    linesToProcess.forEach((line, index) => {
      const trimmedLine = line.trim()

      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return
      }

      try {
        const ast = parse(line) as ParseResult

        try {
          validateAST(ast)
        } catch (validationError) {
          console.error(
            `Validation error on line ${index + 1}: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          )
          process.exit(1)
        }

        const commandNode = ast.commands[0]
        const isFs2xmlCommand = commandNode?.name?.text === 'fs-to-xml'

        if (
          commandNode?.type === 'LogicalExpression' ||
          commandNode?.type === 'Pipeline'
        ) {
          const result = parseASTNode(
            commandNode,
            undefined,
            false,
            startsWithShebang,
            file,
          )
          nodes.push(...result.nodes)
        } else {
          const result = parseASTNode(
            commandNode,
            undefined,
            false,
            startsWithShebang,
            file,
          )
          if (startsWithShebang && isFs2xmlCommand) {
            nodes.push(...result.nodes)
          } else {
            nodes.push({
              type: 'wrapper',
              tag: 'command',
              children: result.nodes,
            })
          }
        }
      } catch (parseError) {
        console.error(
          `Error parsing line ${index + 1}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
        process.exit(1)
      }
    })

    return { nodes }
  } catch (error) {
    console.error(
      `Error reading file '${file}':`,
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

function promoteSpecialTags(
  nodes: ParsedNode[],
  tagsToPromote: string[],
): ParsedNode[] {
  const promoted: ParsedNode[] = []
  const remaining: ParsedNode[] = []

  function extractFromNode(node: ParsedNode): void {
    if (node.type === 'directory' && tagsToPromote.includes(node.name)) {
      promoted.push(node)
    } else if (node.type === 'directory') {
      const newChildren: ParsedNode[] = []
      for (const child of node.children) {
        if (child.type === 'directory' && tagsToPromote.includes(child.name)) {
          promoted.push(child)
        } else {
          newChildren.push(child)
        }
      }
      remaining.push({ ...node, children: newChildren })
    } else {
      remaining.push(node)
    }
  }

  for (const node of nodes) {
    extractFromNode(node)
  }

  return [...remaining, ...promoted]
}

function renderToXml(parsedInfo: ParsedFsInfo, options: Options): string {
  const lines: string[] = []
  const flatten = options.flatten !== false

  function renderNode(node: ParsedNode, indent: string = ''): void {
    if (node.type === 'command') {
      lines.push(`${indent}<${node.commandName}>`)
      lines.push(`${indent}  <input>${node.input}</input>`)

      if (!node.fs2xmlNonShebang) {
        if (!node.hiddenStdout) {
          if (node.stdout === '') {
            lines.push(`${indent}  <stdout />`)
          } else {
            lines.push(`${indent}  <stdout>${node.stdout}</stdout>`)
          }
        }

        if (node.stderr) {
          lines.push(`${indent}  <stderr>${node.stderr}</stderr>`)
        }
      }

      if (node.extraChildren) {
        for (const child of node.extraChildren) {
          renderNode(child, indent + '  ')
        }
      }

      if (!node.fs2xmlNonShebang) {
        if (node.exitCode === 0) {
          lines.push(`${indent}  <success code="0" />`)
        } else {
          lines.push(`${indent}  <failure code="${node.exitCode}" />`)
        }
      } else {
        if (node.stderr) {
          lines.push(`${indent}  <stderr>${node.stderr}</stderr>`)
        }

        if (node.exitCode === 0) {
          lines.push(`${indent}  <success code="0" />`)
        } else {
          lines.push(`${indent}  <failure code="${node.exitCode}" />`)
        }
      }

      lines.push(`${indent}</${node.commandName}>`)
    } else if (node.type === 'logical-and-operator') {
      lines.push(`${indent}<logical-and-operator />`)
    } else if (node.type === 'logical-or-operator') {
      lines.push(`${indent}<logical-or-operator />`)
    } else if (node.type === 'pipe-operator') {
      lines.push(`${indent}<pipe-operator />`)
    } else if (node.type === 'wrapper') {
      lines.push(`${indent}<${node.tag}>`)
      for (const child of node.children) {
        renderNode(child, indent + '  ')
      }
      lines.push(`${indent}</${node.tag}>`)
    } else if (node.type === 'directory') {
      lines.push(`${indent}<${node.name}>`)
      for (const child of node.children) {
        renderNode(child, indent + '  ')
      }
      lines.push(`${indent}</${node.name}>`)
    } else if (node.type === 'content') {
      for (const line of node.lines) {
        lines.push(`${indent}${line}`)
      }
    } else if (node.type === 'empty-tag') {
      lines.push(`${indent}<${node.tag} />`)
    }
  }

  for (const node of parsedInfo.nodes) {
    renderNode(node)
  }

  if (flatten) {
    return flattenConsecutiveTags(lines).join('\n')
  } else {
    return lines.join('\n')
  }
}

function flattenConsecutiveTags(lines: string[]): string[] {
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

async function main() {
  const program = new Command()

  program
    .name('fs-to-xml')
    .description('FS to XML CLI - A simple shebang interpreter')
    .version(packageJson.version)
    .option('--no-flatten', 'disable flattening of consecutive same-named tags')
    .argument('<file>', 'script file to process')
    .action((file, options) => {
      const parsedFsInfo = parseFs(file, options)
      const xmlString = renderToXml(parsedFsInfo, options)
      console.log(xmlString)
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

main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
