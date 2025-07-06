import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { basename, extname, dirname, join } from 'path'
import parse from 'bash-parser'
import { validateAST } from './ast-validator.js'
import type {
  ParseResult,
  CommandResult,
  ParsedNode,
  ParsedDirectory,
  ParsedContent,
  ParsedFsInfo,
  ASTNode,
  Options,
} from './types.js'

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
          throw new Error('Error: fs-to-xml requires a file path')
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
          throw new Error(
            `Error: fs-to-xml only supports .md files, got ${ext || 'no extension'}`,
          )
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
          throw new Error(
            `Error: fs-to-xml failed - ${error instanceof Error ? error.message : String(error)}`,
          )
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
          throw new Error(
            `Validation error in markdown command: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          )
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
        throw new Error(
          `Error parsing markdown command: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
      }
    } else {
      contentLines.push(line)
    }
  })

  flushContent()
  return { nodes }
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

export function parseFs(file: string, _options: Options): ParsedFsInfo {
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
        const parsedContent = parseMarkdownWithCommands(contentToProcess, file)

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

          targetNode.children.push(...parsedContent.nodes)
        }

        const allNodes = mainContentNode
          ? [mainContentNode]
          : parsedContent.nodes
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
          throw new Error(
            `Validation error on line ${index + 1}: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          )
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
        throw new Error(
          `Error parsing line ${index + 1}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        )
      }
    })

    return { nodes }
  } catch (error) {
    throw new Error(
      `Error reading file '${file}': ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
