import { z } from 'zod'
import { existsSync } from 'fs'
import { extname, resolve } from 'path'
import { homedir } from 'os'
import { PathToTagStrategy } from './types.js'

const pathToTagStrategies: PathToTagStrategy[] = [
  'all',
  'head',
  'tail',
  'init',
  'last',
  'rest',
  'none',
]

function expandHomePath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2))
  }
  return filePath
}

function isValidTagName(name: string): boolean {
  if (name.toLowerCase().startsWith('xml')) return false
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)
}

export const cliArgsSchema = z.object({
  file: z
    .string()
    .transform(expandHomePath)
    .refine(
      path => existsSync(path),
      path => ({
        message: `File '${path}' not found`,
      }),
    )
    .refine(
      path => extname(path).toLowerCase() === '.md',
      path => ({
        message: `File '${path}' is not a markdown file (must end with .md)`,
      }),
    ),
  indentSpaces: z
    .union([z.string(), z.number(), z.undefined()])
    .transform(val => {
      if (val === undefined) return undefined
      if (typeof val === 'string') {
        const parsed = parseInt(val, 10)
        if (isNaN(parsed)) {
          throw new Error('--indent-spaces must be a non-negative number')
        }
        return parsed
      }
      return val
    })
    .pipe(
      z
        .number()
        .int('--indent-spaces must be a whole number')
        .nonnegative('--indent-spaces must be a non-negative number')
        .optional(),
    ),
  rootTagName: z
    .string()
    .refine(isValidTagName, name => ({
      message: `Invalid tag name '${name}'. Tag names must start with a letter and contain only letters, numbers, and hyphens.`,
    }))
    .optional(),
  rootTag: z.boolean().optional(),
  convertPathToTagStrategy: z
    .string()
    .optional()
    .default('all')
    .refine(
      (val): val is PathToTagStrategy =>
        pathToTagStrategies.includes(val as PathToTagStrategy),
      val => ({
        message: `Invalid --convert-path-to-tag-strategy value '${val}'. Valid choices are: ${pathToTagStrategies.join(', ')}`,
      }),
    ),
  liftAllTagsToRoot: z.boolean().optional(),
  inlineCommonTags: z.boolean().optional(),
  sortTagsToBottom: z
    .array(
      z.string().refine(isValidTagName, name => ({
        message: `Invalid tag name '${name}'. Tag names must start with a letter and contain only letters, numbers, and hyphens.`,
      })),
    )
    .optional()
    .default([]),
  tagCase: z.enum(['kebab', 'pascal']).optional().default('kebab'),
})

export type CliArgs = z.infer<typeof cliArgsSchema>
