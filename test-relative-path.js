#!/usr/bin/env node
const { execSync } = require('child_process')
const path = require('path')

const cliPath = path.join(__dirname, 'dist/cli.js')

const testContent = '# Test Content\nThis is a test file.'
require('fs').writeFileSync('test.md', testContent)

console.log('Testing path with ..:')
const output = execSync(`${cliPath} ../test.md`, {
  encoding: 'utf8',
  cwd: path.join(__dirname, 'src'),
})
console.log(output)

require('fs').unlinkSync('test.md')
