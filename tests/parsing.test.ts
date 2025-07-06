import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import dedent from 'dedent'

import { parseFs } from '../src/parser.js'

const testDir = join(
  tmpdir(),
  `fs-to-xml-parsing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
)

const writeTestFile = (path: string, content: string): void => {
  const fullPath = join(testDir, path)
  const dir = join(testDir, path.substring(0, path.lastIndexOf('/')))
  mkdirSync(dir, { recursive: true })
  writeFileSync(fullPath, content)
}

describe('parseFs - Basic Command Parsing', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('parses simple echo command', () => {
    writeTestFile('script.sh', 'echo "hello world"')
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]).toMatchObject({
      type: 'wrapper',
      tag: 'command',
      children: [
        {
          type: 'command',
          commandName: 'echo',
          input: 'echo "hello world"',
          exitCode: 0,
        },
      ],
    })
  })

  it('parses multiple commands', () => {
    writeTestFile(
      'script.sh',
      dedent`
      echo first
      echo second
      echo third
    `,
    )
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(3)
    expect(result.nodes[0].type).toBe('wrapper')
    expect(result.nodes[0].children[0].commandName).toBe('echo')
  })

  it('skips empty lines and comments', () => {
    writeTestFile(
      'script.sh',
      dedent`
      # This is a comment
      echo hello
      
      # Another comment
      echo world
    `,
    )
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].children[0].input).toBe('echo hello')
    expect(result.nodes[1].children[0].input).toBe('echo world')
  })
})

describe('parseFs - Logical Operators', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('parses commands with logical AND operator', () => {
    writeTestFile('script.sh', 'echo foo && echo bar')
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    const wrapper = result.nodes[0]
    expect(wrapper.children).toHaveLength(3)
    expect(wrapper.children[0].type).toBe('command')
    expect(wrapper.children[1].type).toBe('logical-and-operator')
    expect(wrapper.children[2].type).toBe('command')
  })

  it('parses commands with logical OR operator', () => {
    writeTestFile('script.sh', 'false || echo fallback')
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    const wrapper = result.nodes[0]
    expect(wrapper.children[0].commandName).toBe('false')
    expect(wrapper.children[1].type).toBe('logical-or-operator')
    expect(wrapper.children[2].commandName).toBe('echo')
  })
})

describe('parseFs - Pipe Operations', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('parses pipe operations', () => {
    writeTestFile('script.sh', 'echo hello | grep h')
    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    const wrapper = result.nodes[0]
    expect(wrapper.children).toHaveLength(3)
    expect(wrapper.children[0].commandName).toBe('echo')
    expect(wrapper.children[1].type).toBe('pipe-operator')
    expect(wrapper.children[2].commandName).toBe('grep')
  })

  it('handles multi-stage pipelines', () => {
    writeTestFile('script.sh', 'echo test | grep t | wc -l')
    const result = parseFs(join(testDir, 'script.sh'), {})

    const wrapper = result.nodes[0]
    expect(wrapper.children).toHaveLength(5)
    expect(wrapper.children[0].commandName).toBe('echo')
    expect(wrapper.children[2].commandName).toBe('grep')
    expect(wrapper.children[4].commandName).toBe('wc')
  })
})

describe('parseFs - fs-to-xml Command', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('parses fs-to-xml command in non-shebang mode', () => {
    writeTestFile('rules/test.md', 'This is a rule file.')
    writeTestFile('script.sh', 'fs-to-xml rules/test.md')

    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    const wrapper = result.nodes[0]
    expect(wrapper.type).toBe('wrapper')
    expect(wrapper.tag).toBe('command')
    const command = wrapper.children[0]
    expect(command.commandName).toBe('fs-to-xml')
    expect(command.exitCode).not.toBe(0)
  })

  it('parses fs-to-xml command in shebang mode', () => {
    writeTestFile('rules/test.md', 'This is a rule file.')
    writeTestFile(
      'script.sh',
      dedent`
      #!/usr/bin/env fs-to-xml
      fs-to-xml ${join(testDir, 'rules/test.md')}
    `,
    )

    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('directory')
    expect(result.nodes[0].name).toBe('tmp')
  })

  it('handles nested directories in fs-to-xml', () => {
    writeTestFile('docs/api/v2/test.md', 'API documentation')
    writeTestFile(
      'script.sh',
      dedent`
      #!/usr/bin/env fs-to-xml
      fs-to-xml ${join(testDir, 'docs/api/v2/test.md')}
    `,
    )

    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('directory')
    expect(result.nodes[0].name).toBe('tmp')
  })
})

describe('parseFs - Markdown File Processing', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('processes markdown file directly', () => {
    writeTestFile(
      'rules/test.md',
      dedent`
      This is a rule file.
      With multiple lines.
    `,
    )

    const result = parseFs(join(testDir, 'rules/test.md'), {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('directory')
    const tmpDir = result.nodes[0]
    expect(tmpDir.name).toBe('tmp')
    let currentDir = tmpDir
    while (
      currentDir.children.length > 0 &&
      currentDir.children[0].type === 'directory'
    ) {
      currentDir = currentDir.children[0]
    }
    const content = currentDir.children[0]
    expect(content.type).toBe('content')
    expect(content.lines).toHaveLength(2)
  })

  it('strips empty lines from markdown', () => {
    writeTestFile(
      'rules/test.md',
      dedent`
      Line one
      
      Line two
      
      
      Line three
    `,
    )

    const result = parseFs(join(testDir, 'rules/test.md'), {})

    let currentDir = result.nodes[0]
    while (
      currentDir.children.length > 0 &&
      currentDir.children[0].type === 'directory'
    ) {
      currentDir = currentDir.children[0]
    }
    const content = currentDir.children[0]
    expect(content.type).toBe('content')
    expect(content.lines).toHaveLength(3)
    expect(content.lines).toEqual(['Line one', 'Line two', 'Line three'])
  })

  it('processes markdown with shebang and !! commands', () => {
    writeTestFile(
      'rules/test.md',
      dedent`
      #!/usr/bin/env fs-to-xml
      Regular content
      !! echo "Command output"
      More content
    `,
    )

    const result = parseFs(join(testDir, 'rules/test.md'), {})

    expect(result.nodes).toHaveLength(1)

    let currentDir = result.nodes[0]
    while (
      currentDir.children.length > 0 &&
      currentDir.children[0].type === 'directory'
    ) {
      currentDir = currentDir.children[0]
    }

    expect(currentDir.children.length).toBeGreaterThan(0)

    // Check the structure recursively for content and commands
    function findNodeTypes(nodes) {
      const types = new Set()
      for (const node of nodes) {
        types.add(node.type)
        if (node.children) {
          const childTypes = findNodeTypes(node.children)
          childTypes.forEach(t => types.add(t))
        }
      }
      return types
    }

    const nodeTypes = findNodeTypes(currentDir.children)
    expect(nodeTypes.has('content')).toBe(true)
    expect(nodeTypes.has('command') || nodeTypes.has('wrapper')).toBe(true)
  })

  it('handles !! fs-to-xml commands as siblings', () => {
    writeTestFile('rules/rule1.md', 'Rule 1 content')
    writeTestFile('rules/rule2.md', 'Rule 2 content')
    writeTestFile(
      'docs/main.md',
      dedent`
      #!/usr/bin/env fs-to-xml
      Main content
      !!fs-to-xml ${join(testDir, 'rules/rule1.md')}
      !!fs-to-xml ${join(testDir, 'rules/rule2.md')}
      More content
    `,
    )

    const result = parseFs(join(testDir, 'docs/main.md'), {})

    expect(result.nodes.length).toBeGreaterThanOrEqual(1)
    const firstNode = result.nodes[0]
    expect(firstNode.type).toBe('directory')
    expect(firstNode.name).toBe('tmp')
  })
})

describe('parseFs - Shebang Mode', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('processes shebang scripts differently than regular scripts', () => {
    writeTestFile(
      'script.sh',
      dedent`
      #!/usr/bin/env fs-to-xml
      echo "test"
    `,
    )

    const result = parseFs(join(testDir, 'script.sh'), {})

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('wrapper')
  })

  it('handles path resolution in shebang mode', () => {
    writeTestFile('scripts/data/test.md', 'Test content')
    writeTestFile(
      'scripts/run.sh',
      dedent`
      #!/usr/bin/env fs-to-xml
      fs-to-xml ./data/test.md
    `,
    )

    const result = parseFs(join(testDir, 'scripts/run.sh'), {})

    expect(result.nodes[0].type).toBe('directory')
    expect(result.nodes[0].name).toBe('data')
  })
})

describe('parseFs - Error Handling', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {}
  })

  it('handles fs-to-xml with non-markdown file', () => {
    writeTestFile('test.txt', 'Text file')
    writeTestFile('script.sh', 'fs-to-xml test.txt')

    const result = parseFs(join(testDir, 'script.sh'), {})

    const command = result.nodes[0].children[0]
    expect(command.exitCode).not.toBe(0)
    expect(command.stderr).toContain('only supports .md files')
  })

  it('handles fs-to-xml with missing file', () => {
    writeTestFile('script.sh', 'fs-to-xml nonexistent.md')

    const result = parseFs(join(testDir, 'script.sh'), {})

    const command = result.nodes[0].children[0]
    expect(command.exitCode).not.toBe(0)
    expect(command.stderr).toContain('Error reading file')
  })

  it('handles commands that fail', () => {
    writeTestFile('script.sh', 'false')

    const result = parseFs(join(testDir, 'script.sh'), {})

    const command = result.nodes[0].children[0]
    expect(command.commandName).toBe('false')
    expect(command.exitCode).toBe(1)
  })
})
