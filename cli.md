# Tag Composer CLI Guide

This guide covers using tag-composer from the command line.

## Installation

```bash
npm install -g tag-composer
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

| Library Option             | CLI Flag                         |
| -------------------------- | -------------------------------- |
| `indentSpaces`             | `--indent-spaces`                |
| `rootTagName`              | `--root-tag-name`                |
| `rootTag`                  | `--root-tag` / `--no-root-tag`   |
| `convertPathToTagStrategy` | `--convert-path-to-tag-strategy` |
| `liftAllTagsToRoot`        | `--lift-all-tags-to-root`        |
| `inlineCommonTags`         | `--inline-common-tags`           |

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

### Multiple Options

```bash
tag-composer \
  --indent-spaces 2 \
  --root-tag-name documentation \
  --lift-all-tags-to-root \
  --inline-common-tags \
  input.md > output.xml
```

## Help

View all available options:

```bash
tag-composer --help
```

Check version:

```bash
tag-composer --version
```

## Processing Multiple Files

Process multiple files using shell scripting:

```bash
# Process all markdown files in a directory
for file in docs/*.md; do
  tag-composer "$file" > "output/$(basename "$file" .md).xml"
done
```

## Integration with Other Tools

Pipe output to other commands:

```bash
# Pretty print with xmllint
tag-composer input.md | xmllint --format -

# Extract specific tags with xmlstarlet
tag-composer input.md | xmlstarlet sel -t -v "//methods"
```

## Exit Codes

- `0`: Success
- `1`: Error (invalid file, circular dependency, invalid options)

## Common Use Cases

### Documentation Processing

```bash
tag-composer --root-tag-name docs --convert-path-to-tag-strategy last index.md
```

### Markdown to XML Pipeline

```bash
tag-composer input.md | xsltproc transform.xsl - > final.html
```

### Validation

```bash
tag-composer input.md && echo "Valid" || echo "Error"
```
