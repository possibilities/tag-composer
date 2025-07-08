# Tag Composer

Compose the content of markdown files into an xml-like tag structure.

## Install

```bash
npm install tag-composer
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
