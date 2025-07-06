declare module 'bash-parser' {
  interface ASTNode {
    type: string
    [key: string]: any
  }

  function parse(input: string): ASTNode

  export = parse
}
