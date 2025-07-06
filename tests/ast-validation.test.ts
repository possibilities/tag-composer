import { describe, it, expect } from 'vitest'
import parse from 'bash-parser'
import { validateAST } from '../src/ast-validator'

describe('AST Validation', () => {
  describe('Valid commands', () => {
    it('accepts simple commands', () => {
      const validCommands = [
        'echo hello',
        'ls -la',
        'cat file.txt',
        'grep pattern',
        'pwd',
        'echo "test with spaces"',
        'command arg1 arg2 arg3',
      ]

      validCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).not.toThrow()
      })
    })

    it('accepts commands with pipes', () => {
      const validPipelines = [
        'echo hello | grep h',
        'cat file | head | tail',
        'ls -la | grep test | wc -l',
        'ps aux | grep node',
      ]

      validPipelines.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).not.toThrow()
      })
    })

    it('accepts commands with logical AND', () => {
      const validCommands = [
        'echo hello && echo world',
        'mkdir test && cd test',
        'npm test && npm build',
      ]

      validCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).not.toThrow()
      })
    })

    it('accepts commands with logical OR', () => {
      const validCommands = [
        'echo hello || echo error',
        'test -f file || touch file',
        'npm start || echo "Failed to start"',
      ]

      validCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).not.toThrow()
      })
    })

    it('accepts complex combinations of pipes and logical operators', () => {
      const validCommands = [
        'echo foo | grep f && ls || pwd',
        'cat file | head && echo success || echo failure',
        'ls | grep test && echo found || echo not found',
      ]

      validCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).not.toThrow()
      })
    })
  })

  describe('Invalid commands', () => {
    it('rejects subshells', () => {
      const invalidCommands = [
        '(echo hello)',
        '(ls && pwd)',
        '(echo test | grep t)',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(
          'Subshells (parentheses grouping) are not supported',
        )
      })
    })

    it('rejects command substitution', () => {
      const invalidCommands = ['echo $(date)', 'echo `pwd`', 'ls $(which node)']

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('Command substitution')
      })
    })

    it('rejects brace grouping', () => {
      const invalidCommands = [
        '{ echo hello; }',
        '{ ls; pwd; }',
        '{ echo test; } > output.txt',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(
          'Compound lists (brace grouping) are not supported',
        )
      })
    })

    it('rejects if statements', () => {
      const invalidCommands = [
        'if [ -f file ]; then echo yes; fi',
        'if true; then echo ok; else echo not ok; fi',
        'if test -d dir; then ls dir; fi',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(
          'If statements are not supported',
        )
      })
    })

    it('rejects for loops', () => {
      const invalidCommands = [
        'for i in 1 2 3; do echo $i; done',
        'for file in *.txt; do cat $file; done',
        'for x in a b c; do echo $x; done',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('For loops are not supported')
      })
    })

    it('rejects while loops', () => {
      const invalidCommands = [
        'while true; do echo loop; done',
        'while [ $i -lt 10 ]; do echo $i; done',
        'while read line; do echo $line; done',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('While loops are not supported')
      })
    })

    it('rejects until loops', () => {
      const invalidCommands = [
        'until false; do echo loop; done',
        'until [ $i -gt 10 ]; do echo $i; done',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('Until loops are not supported')
      })
    })

    it('rejects case statements', () => {
      const invalidCommands = [
        'case $var in a) echo A;; b) echo B;; esac',
        'case "$1" in start) echo starting;; stop) echo stopping;; esac',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(
          'Case statements are not supported',
        )
      })
    })

    it('rejects function definitions', () => {
      const invalidCommand = 'greet() { echo hi; }'

      const ast = parse(invalidCommand)
      expect(() => validateAST(ast)).toThrow(
        'Function definitions are not supported',
      )
    })

    it('rejects parameter expansion', () => {
      const invalidCommands = [
        'echo ${VAR}',
        'echo ${VAR:-default}',
        'echo ${#VAR}',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('Parameter expansion')
      })
    })

    it('rejects arithmetic expansion', () => {
      const invalidCommands = [
        'echo $((1+1))',
        'echo $((10 * 5))',
        'echo $((VAR + 2))',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('Arithmetic expansion')
      })
    })

    it('rejects redirections', () => {
      const invalidCommands = [
        'echo hello > file.txt',
        'cat < input.txt',
        'ls -la > output.txt 2> error.txt',
        'echo test >> append.txt',
        'command > out.txt < in.txt',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow('Redirections are not supported')
      })
    })

    it('rejects variable assignments', () => {
      const invalidCommands = [
        'VAR=value echo hello',
        'FOO=bar BAZ=qux command',
        'TEST=1',
        'A=1 B=2 C=3 echo test',
      ]

      invalidCommands.forEach(cmd => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(
          'Variable assignments are not supported',
        )
      })
    })
  })

  describe('Error messages', () => {
    it('includes line numbers in error messages', () => {
      const script = parse('echo hello')
      script.commands.push({ type: 'Subshell' })

      expect(() => validateAST(script)).toThrow('(line 2)')
    })

    it('provides clear messages for unsupported features', () => {
      const testCases = [
        { cmd: '(echo test)', expected: 'Subshells (parentheses grouping)' },
        { cmd: '{ echo test; }', expected: 'Compound lists (brace grouping)' },
        { cmd: 'for i in 1; do echo $i; done', expected: 'For loops' },
        { cmd: 'if true; then echo yes; fi', expected: 'If statements' },
        { cmd: 'echo ${VAR}', expected: 'Parameter expansion' },
        { cmd: 'echo $(date)', expected: 'Command substitution' },
        { cmd: 'echo $((1+1))', expected: 'Arithmetic expansion' },
      ]

      testCases.forEach(({ cmd, expected }) => {
        const ast = parse(cmd)
        expect(() => validateAST(ast)).toThrow(expected)
      })
    })
  })
})
