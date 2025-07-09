# Tag Composer CLI Guide

This guide covers using tag-composer from the command line.

## Installation

```bash
pnpm install -g tag-composer
```

Or use it directly with npx:

```bash
npx tag-composer input.md
```

## Basic Usage

Process a markdown file and output XML to stdout:

```bash
tag-composer input.md
```

Save output to a file:

```bash
tag-composer input.md > output.xml
```

## CLI Options

The CLI accepts the same options as the [library API](./lib.md#options). Options are passed using `--` flags with kebab-case names.

### Option Mapping

| Library Option             | CLI Flag                          |
| -------------------------- | --------------------------------- |
| `indentSpaces`             | `--indent-spaces`                 |
| `rootTagName`              | `--root-tag-name`                 |
| `rootTag`                  | `--root-tag` / `--no-root-tag`    |
| `convertPathToTagStrategy` | `--convert-path-to-tag-strategy`  |
| `liftAllTagsToRoot`        | `--lift-all-tags-to-root`         |
| `inlineCommonTags`         | `--inline-common-tags`            |
| `sortTagsToBottom`         | `--sort-tag-to-bottom` (multiple) |
| `tagCase`                  | `--tag-case`                      |

See the [library guide](./lib.md#options) for detailed explanations of each option.

## Examples

### Custom Indentation

```bash
tag-composer --indent-spaces 4 input.md
```

### Custom Root Tag

```bash
tag-composer --root-tag-name article input.md
```

### No Root Tag

```bash
tag-composer --no-root-tag input.md
```

### Path Strategy

```bash
tag-composer --convert-path-to-tag-strategy last docs/api/methods.md
```

### Sort Tags to Bottom

Move specific tags to appear after their siblings:

```bash
tag-composer --sort-tag-to-bottom footer --sort-tag-to-bottom appendix input.md
```

This option can be specified multiple times to sort multiple tags. The specified tags will be moved to appear after all their sibling elements while maintaining their original order relative to each other.

### Tag Case Styles

Transform tag names to different case styles:

```bash
# Default PascalCase
tag-composer input.md

# kebab-case
tag-composer --tag-case kebab input.md

# UPPERCASE
tag-composer --tag-case shout input.md

# mEmE cAsE (for fun!)
tag-composer --tag-case meme input.md
```

Available case styles:

- `pascal` (default): PascalCase - `<MyTagName>`
- `kebab`: kebab-case - `<my-tag-name>`
- `shout`: UPPERCASE - `<MYTAGNAME>`
- `meme`: mEmE cAsE - `<mYtAgNaMe>`

### Multiple Options

```bash
tag-composer \
  --indent-spaces 2 \
  --root-tag-name documentation \
  --lift-all-tags-to-root \
  --inline-common-tags \
  --tag-case kebab \
  input.md > output.xml
```
