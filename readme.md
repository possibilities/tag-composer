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

## Library

```javascript
import { composeTags } from 'tag-composer'

const output = composeTags('input.md')
console.log(output)
```
