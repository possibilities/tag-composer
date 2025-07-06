import { z } from 'zod'

const WordSchema = z.object({
  type: z.literal('Word'),
  text: z.string(),
  expansion: z.array(z.any()).optional(),
})

const CommandSchema: z.ZodType<any> = z.object({
  type: z.literal('Command'),
  name: WordSchema.optional(),
  prefix: z.array(z.any()).optional(),
  suffix: z.array(z.any()).optional(),
  async: z.boolean().optional(),
})

const PipelineSchema: z.ZodType<any> = z.object({
  type: z.literal('Pipeline'),
  commands: z.array(z.lazy(() => CommandSchema)),
  bang: z.boolean().optional(),
})

const LogicalExpressionSchema: z.ZodType<any> = z.object({
  type: z.literal('LogicalExpression'),
  op: z.enum(['and', 'or']),
  left: z.lazy(() =>
    z.union([LogicalExpressionSchema, PipelineSchema, CommandSchema]),
  ),
  right: z.lazy(() =>
    z.union([LogicalExpressionSchema, PipelineSchema, CommandSchema]),
  ),
  async: z.boolean().optional(),
})

const SupportedCommandSchema = z.union([
  CommandSchema,
  PipelineSchema,
  LogicalExpressionSchema,
])

const SubshellSchema = z.object({
  type: z.literal('Subshell'),
})

const CompoundListSchema = z.object({
  type: z.literal('CompoundList'),
})

const ForSchema = z.object({
  type: z.literal('For'),
})

const WhileSchema = z.object({
  type: z.literal('While'),
})

const UntilSchema = z.object({
  type: z.literal('Until'),
})

const IfSchema = z.object({
  type: z.literal('If'),
})

const CaseSchema = z.object({
  type: z.literal('Case'),
})

const FunctionSchema = z.object({
  type: z.literal('Function'),
})

const UnsupportedNodeSchema = z.union([
  SubshellSchema,
  CompoundListSchema,
  ForSchema,
  WhileSchema,
  UntilSchema,
  IfSchema,
  CaseSchema,
  FunctionSchema,
])

const ScriptSchema = z.object({
  type: z.literal('Script'),
  commands: z.array(z.any()),
})

function checkForExpansions(node: any, path: string = ''): void {
  if (node && typeof node === 'object') {
    if (
      node.expansion &&
      Array.isArray(node.expansion) &&
      node.expansion.length > 0
    ) {
      const expansion = node.expansion[0]
      if (expansion.type === 'ParameterExpansion') {
        throw new Error(
          `Parameter expansion (\${...}) is not supported${path ? ` at ${path}` : ''}`,
        )
      }
      if (expansion.type === 'CommandExpansion') {
        throw new Error(
          `Command substitution (\$(...) or \`...\`) is not supported${path ? ` at ${path}` : ''}`,
        )
      }
      if (expansion.type === 'ArithmeticExpansion') {
        throw new Error(
          `Arithmetic expansion (\$((...)))) is not supported${path ? ` at ${path}` : ''}`,
        )
      }
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) =>
        checkForExpansions(item, `${path}[${index}]`),
      )
    } else {
      Object.entries(node).forEach(([key, value]) => {
        if (key !== 'type' && value) {
          checkForExpansions(value, path ? `${path}.${key}` : key)
        }
      })
    }
  }
}

function checkForFsToXmlInCompound(command: any): void {
  if (command.type === 'Command') {
    if (command.name?.text === 'fs-to-xml') {
      return
    }
  } else if (command.type === 'Pipeline') {
    command.commands.forEach((cmd: any) => {
      if (cmd.name?.text === 'fs-to-xml') {
        throw new Error('fs-to-xml cannot be used in pipe operations')
      }
    })
  } else if (command.type === 'LogicalExpression') {
    const checkNode = (node: any): void => {
      if (node.type === 'Command' && node.name?.text === 'fs-to-xml') {
        throw new Error(
          'fs-to-xml cannot be used with logical operators (&&, ||)',
        )
      } else if (node.type === 'Pipeline') {
        node.commands.forEach((cmd: any) => {
          if (cmd.name?.text === 'fs-to-xml') {
            throw new Error('fs-to-xml cannot be used in compound commands')
          }
        })
      } else if (node.type === 'LogicalExpression') {
        checkNode(node.left)
        checkNode(node.right)
      }
    }
    checkNode(command.left)
    checkNode(command.right)
  }
}

function checkForUnsupportedFeatures(command: any): void {
  if (command.type === 'Command') {
    if (command.prefix && Array.isArray(command.prefix)) {
      command.prefix.forEach((item: any) => {
        if (item.type === 'AssignmentWord') {
          throw new Error('Variable assignments are not supported')
        }
        if (item.type === 'Redirect') {
          throw new Error('Redirections are not supported')
        }
      })
    }

    if (command.suffix && Array.isArray(command.suffix)) {
      command.suffix.forEach((item: any) => {
        if (item.type === 'Redirect') {
          throw new Error('Redirections are not supported')
        }
      })
    }
  } else if (command.type === 'Pipeline') {
    command.commands.forEach((cmd: any) => checkForUnsupportedFeatures(cmd))
  } else if (command.type === 'LogicalExpression') {
    checkForUnsupportedFeatures(command.left)
    checkForUnsupportedFeatures(command.right)
  }
}

function getFeatureName(nodeType: string): string {
  const featureNames: Record<string, string> = {
    Subshell: 'Subshells (parentheses grouping)',
    CompoundList: 'Compound lists (brace grouping)',
    For: 'For loops',
    While: 'While loops',
    Until: 'Until loops',
    If: 'If statements',
    Case: 'Case statements',
    Function: 'Function definitions',
  }
  return featureNames[nodeType] || nodeType
}

export function validateAST(ast: any): void {
  const scriptResult = ScriptSchema.safeParse(ast)
  if (!scriptResult.success) {
    throw new Error('Invalid AST structure: expected Script node at root')
  }

  const script = scriptResult.data

  for (let i = 0; i < script.commands.length; i++) {
    const command = script.commands[i]

    const unsupportedResult = UnsupportedNodeSchema.safeParse(command)
    if (unsupportedResult.success) {
      throw new Error(
        `${getFeatureName(command.type)} are not supported (line ${i + 1})`,
      )
    }

    const supportedResult = SupportedCommandSchema.safeParse(command)
    if (!supportedResult.success) {
      throw new Error(
        `Unsupported command type: ${command.type || 'unknown'} (line ${i + 1})`,
      )
    }

    try {
      checkForExpansions(command, `commands[${i}]`)
      checkForUnsupportedFeatures(command)
      checkForFsToXmlInCompound(command)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${error.message} (line ${i + 1})`)
      }
      throw error
    }
  }
}
