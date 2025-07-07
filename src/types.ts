export interface TagWithAttributes {
  name: string
  attrs: Record<string, string>
}

export type TypeValue = string | TagWithAttributes

export function getTypeName(type: TypeValue): string {
  return typeof type === 'string' ? type : type.name
}
