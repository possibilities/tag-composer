#!/usr/bin/env node
const { execSync } = require('child_process')
const path = require('path')

// Test with relative paths containing ..
const cliPath = path.join(__dirname, 'dist/cli.js')

// Create a test markdown file
const testContent = '# Test Content\nThis is a test file.'
require('fs').writeFileSync('test.md', testContent)

console.log('Testing path with ..:')
const output = execSync(`${cliPath} ../test.md`, {
  encoding: 'utf8',
  cwd: path.join(__dirname, 'src'),
})
console.log(output)

// Clean up
require('fs').unlinkSync('test.md')
