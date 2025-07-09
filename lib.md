# Tag Composer Library Guide

This guide covers using tag-composer as a TypeScript/JavaScript library in your projects.

## Installation

```bash
pnpm add tag-composer
```

## Basic Usage

```typescript
import { composeTags } from 'tag-composer'

const output = composeTags('path/to/input.md')
console.log(output)
```

## API Reference

### composeTags(filePath, options?)

Processes a markdown file and returns the composed XML output as a string.

#### Parameters

- `filePath` (string, required): Path to the markdown file to process
- `options` (object, optional): Configuration options

#### Options

```typescript
interface ComposeTagsOptions {
  indentSpaces?: string | number // Number of spaces for indentation (default: 2)
  rootTagName?: string // Name of the root XML tag (default: 'document')
  rootTag?: boolean // Whether to include a root tag (default: true)
  convertPathToTagStrategy?: string // How to convert file paths to tag names
  liftAllTagsToRoot?: boolean // Lift all nested tags to root level
  inlineCommonTags?: boolean // Merge multiple tags with the same name
  sortTagsToBottom?: string[] // Tag names to move after their siblings
  tagCase?: string // Case style for tag names ('pascal', 'kebab', 'shout', 'meme', default: 'pascal')
}
```

#### Returns

Returns a string containing the processed XML output.

## Path to Tag Strategies

The `convertPathToTagStrategy` option controls how file paths are converted to XML tag names:

- `'all'` (default): Uses the full path as nested tags
- `'head'`: Uses only the first segment of the path
- `'tail'`: Uses only the last segment of the path
- `'init'`: Uses all segments except the last
- `'last'`: Uses only the filename without extension
- `'rest'`: Uses all segments except the first
- `'none'`: No path-based tags, only content

## Examples

### Basic Example

```typescript
import { composeTags } from 'tag-composer'

// Process a markdown file with default options
const result = composeTags('docs/guide.md')
```

### Custom Indentation

```typescript
const result = composeTags('input.md', {
  indentSpaces: 4, // Use 4 spaces for indentation
})
```

### Custom Root Tag

```typescript
const result = composeTags('input.md', {
  rootTagName: 'article', // Use <article> instead of <document>
})
```

### No Root Tag

```typescript
const result = composeTags('input.md', {
  rootTag: false, // Omit the root tag entirely
})
```

### Path Strategy Examples

Given a markdown file at `docs/api/methods.md`:

```typescript
// Default: 'all' - creates <docs><api><methods>
const result1 = composeTags('docs/api/methods.md')

// 'last' - creates only <methods>
const result2 = composeTags('docs/api/methods.md', {
  convertPathToTagStrategy: 'last',
})

// 'none' - no path-based tags
const result3 = composeTags('docs/api/methods.md', {
  convertPathToTagStrategy: 'none',
})
```

### Tag Transformations

```typescript
// Lift all tags to root level (flatten structure)
const result = composeTags('input.md', {
  liftAllTagsToRoot: true,
})

// Merge multiple occurrences of the same tag
const result = composeTags('input.md', {
  inlineCommonTags: true,
})

// Move specific tags to appear after their siblings
const result = composeTags('input.md', {
  sortTagsToBottom: ['footer', 'appendix', 'metadata'],
})
```

### Tag Case Styles

Control how tag names are formatted using the `tagCase` option:

```typescript
// 'pascal' (default) - PascalCase: MyTagName
const result1 = composeTags('input.md', {
  tagCase: 'pascal',
})

// 'kebab' - kebab-case: my-tag-name
const result2 = composeTags('input.md', {
  tagCase: 'kebab',
})

// 'shout' - UPPERCASE: MYTAGNAME
const result3 = composeTags('input.md', {
  tagCase: 'shout',
})

// 'meme' - mEmE cAsE: mYtAgNaMe (alternating caps for fun!)
const result4 = composeTags('input.md', {
  tagCase: 'meme',
})
```

Example output for a tag `<UserAccount>`:

- `pascal`: `<UserAccount>` (default)
- `kebab`: `<user-account>`
- `shout`: `<USERACCOUNT>`
- `meme`: `<uSeRaCcOuNt>`

## Markdown References

Tag composer processes markdown files that can contain references to other markdown files using the `@@` syntax:

```markdown
# Main Document

@@subdocs/intro.md
@@subdocs/chapter1.md
@@subdocs/conclusion.md
```

These references are resolved recursively and wrapped in XML tags based on their file paths.

### Path Resolution

All `@@` directive paths are resolved relative to the **entrypoint file** (the file passed to `composeTags()`), not relative to the file containing the directive. This ensures consistent path resolution regardless of nesting depth.

```typescript
// Given this file structure:
// project/
//   docs/
//     index.md
//     intro.md
//     api/
//       overview.md

// When calling:
composeTags('docs/index.md')

// In docs/index.md:
// @@intro.md        -> resolves to docs/intro.md
// @@api/overview.md -> resolves to docs/api/overview.md

// Even in nested files, paths are still relative to docs/ (the entrypoint directory)
```

**Absolute paths** (starting with `/`) are always used as-is without modification.

## Error Handling

The function throws errors for:

- Invalid file paths
- Circular dependencies between files
- Invalid option values

```typescript
try {
  const result = composeTags('input.md', { indentSpaces: 4 })
  console.log(result)
} catch (error) {
  console.error('Failed to compose tags:', error.message)
}
```

## TypeScript Support

The library includes TypeScript definitions. You can import types for better IDE support:

```typescript
import {
  composeTags,
  type ComposeTagsOptions,
  type TagCaseStyle,
} from 'tag-composer'

const options: ComposeTagsOptions = {
  indentSpaces: 2,
  rootTagName: 'document',
  rootTag: true,
  tagCase: 'kebab' as TagCaseStyle,
}

const result = composeTags('input.md', options)
```

## Complete Example

```typescript
import { composeTags } from 'tag-composer'
import { writeFileSync } from 'fs'

// Process a markdown file with custom options
const xmlOutput = composeTags('docs/index.md', {
  indentSpaces: 2,
  rootTagName: 'documentation',
  convertPathToTagStrategy: 'last',
  liftAllTagsToRoot: false,
  inlineCommonTags: true,
  tagCase: 'kebab',
})

// Write the output to a file
writeFileSync('output.xml', xmlOutput)
```

## Integration with Build Tools

Tag composer can be integrated into build pipelines:

```typescript
// vite.config.ts or webpack.config.js
import { composeTags } from 'tag-composer'

function processMarkdownFiles(files) {
  return files.map(file => ({
    path: file,
    content: composeTags(file, { rootTagName: 'doc' }),
  }))
}
```
