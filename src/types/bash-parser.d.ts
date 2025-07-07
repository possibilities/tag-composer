declare module 'bash-parser' {
  import { AstNode } from '../types.js'

  function parse(script: string): AstNode
  export default parse
}
