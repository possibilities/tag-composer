# Tag Composer

[![npm version](https://badge.fury.io/js/tag-composer.svg)](https://www.npmjs.com/package/tag-composer)

Compose the content of markdown files into an xml-like tag structure.

## What does it do?

Tag Composer processes markdown files that can reference other markdown files using `@@` syntax, and outputs XML with the composed content wrapped in tags based on file paths.

```bash
$ tree docs/
docs/
├── index.md
├── intro.md
└── api/
    ├── overview.md
    └── methods.md
```

```bash
$ cat docs/index.md
Documentation
@@docs/intro.md
@@docs/api/overview.md
```

**Note:** All `@@` directive paths are resolved relative to the entrypoint file (the file specified on the command line). Absolute paths (starting with `/`) are used as-is.

```bash
$ cat docs/intro.md
Welcome to our project!
This is the introduction.
```

```bash
$ tag-composer docs/index.md
<document>
  <docs>
    <index>
      Documentation
      <intro>
        Welcome to our project!
        This is the introduction.
      </intro>
      <api>
        <overview>
          API Overview content here...
        </overview>
      </api>
    </index>
  </docs>
</document>
```

The CLI and library support various options to control how tags are generated and structured. You can customize the root tag name, change indentation, modify how file paths are converted to tags, flatten the tag hierarchy, and merge duplicate tags. See the [CLI Guide](./cli.md) and [Library Guide](./lib.md) for all available options.

## Install

```bash
pnpm add tag-composer
```

## CLI

```bash
tag-composer input.md
```

Learn more in the [CLI Guide](./cli.md)

## Library

```javascript
import { composeTags } from 'tag-composer'

const output = composeTags('input.md')
console.log(output)
```

Learn more in the [Library Guide](./lib.md)

## Tasks

- [ ] Split into CLI and Library packages to avoid taking on CLI dependencies in the library
