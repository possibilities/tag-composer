# Tag Composer

Compose markdown files with references into XML-tagged documents.

## Install

```bash
npm install tag-composer
```

## CLI

```bash
tag-composer input.md
```

See the [CLI Guide](./cli.md) for detailed usage and options.

## Library

```javascript
import { composeTags } from 'tag-composer'

const output = composeTags('input.md')
console.log(output)
```

See the [Library Guide](./lib.md) for detailed usage and options.
