import { ParsedLine, XmlElement, XmlNode } from './types.js'

function isXmlElement(node: XmlNode): node is XmlElement {
  return node.type === 'element'
}

export function sortTagsToBottom(
  elements: ParsedLine[],
  tagNames: string[],
): ParsedLine[] {
  if (!tagNames || tagNames.length === 0) {
    return elements
  }

  const tagNamesSet = new Set(tagNames)
  const tagOrderMap = new Map(tagNames.map((name, index) => [name, index]))

  function sortElementsRecursively(nodes: XmlNode[]): XmlNode[] {
    const topNodes: XmlNode[] = []
    const bottomNodes: XmlNode[] = []

    for (const node of nodes) {
      if (isXmlElement(node)) {
        const shouldMoveToBottom = tagNamesSet.has(node.name)

        const processedNode = { ...node }
        if (node.elements) {
          processedNode.elements = sortElementsRecursively(node.elements)
        }

        if (shouldMoveToBottom) {
          bottomNodes.push(processedNode)
        } else {
          topNodes.push(processedNode)
        }
      } else {
        topNodes.push(node)
      }
    }

    const sortedBottomNodes = bottomNodes.sort((a, b) => {
      const aIndex = tagOrderMap.get((a as XmlElement).name) ?? Infinity
      const bIndex = tagOrderMap.get((b as XmlElement).name) ?? Infinity
      return aIndex - bIndex
    })

    return [...topNodes, ...sortedBottomNodes]
  }

  return sortElementsRecursively(elements) as ParsedLine[]
}

export function liftAllTagsToRoot(elements: ParsedLine[]): ParsedLine[] {
  const result: ParsedLine[] = []

  const isDocumentWrapper =
    elements.length === 1 &&
    elements[0].type === 'element' &&
    (elements[0] as XmlElement).name === 'document'

  function extractAndLiftNestedElements(
    element: XmlElement,
    depth: number = 0,
  ): { element: XmlElement | null; lifted: XmlElement[] } {
    if (!element.elements) {
      return { element, lifted: [] }
    }

    const textNodes: XmlNode[] = []
    const elementNodes: XmlElement[] = []
    const liftedElements: XmlElement[] = []

    for (const child of element.elements) {
      if (isXmlElement(child)) {
        const processed = extractAndLiftNestedElements(child, depth + 1)

        const shouldKeepInPlace = isDocumentWrapper && depth === 0

        if (shouldKeepInPlace) {
          if (processed.element) {
            elementNodes.push(processed.element)
          }
        } else if (processed.element) {
          liftedElements.push(processed.element)
        }

        liftedElements.push(...processed.lifted)
      } else {
        textNodes.push(child)
      }
    }

    const parentIsEmptyAfterLifting =
      textNodes.length === 0 && elementNodes.length === 0
    if (parentIsEmptyAfterLifting && liftedElements.length > 0) {
      return { element: null, lifted: liftedElements }
    }

    const remainingChildren = [...textNodes, ...elementNodes]
    const updatedElement = {
      ...element,
      elements: remainingChildren.length > 0 ? remainingChildren : undefined,
    }

    return { element: updatedElement, lifted: liftedElements }
  }

  for (const element of elements) {
    if (element.type === 'element') {
      const processed = extractAndLiftNestedElements(element)
      if (processed.element) {
        result.push(processed.element)
      }
      result.push(...processed.lifted)
    } else {
      result.push(element)
    }
  }

  return result
}

function filterParsedElements(elements: XmlNode[]): ParsedLine[] {
  return elements.filter(
    (el): el is ParsedLine => el.type === 'element' || el.type === 'text',
  )
}

export function inlineCommonTags(elements: ParsedLine[]): ParsedLine[] {
  const result: ParsedLine[] = []
  const elementsByTagName = new Map<string, XmlElement[]>()

  for (const element of elements) {
    if (element.type === 'element') {
      const existingGroup = elementsByTagName.get(element.name) || []
      elementsByTagName.set(element.name, [...existingGroup, element])
    } else {
      result.push(element)
    }
  }

  for (const [tagName, sameNameElements] of elementsByTagName) {
    if (sameNameElements.length === 1) {
      const singleElement = sameNameElements[0]
      if (singleElement.elements) {
        const parsedChildren = filterParsedElements(singleElement.elements)
        singleElement.elements = inlineCommonTags(parsedChildren) as XmlNode[]
      }
      result.push(singleElement)
    } else {
      const allChildElements: XmlNode[] = []
      const firstElementAttributes = sameNameElements[0].attributes

      for (const element of sameNameElements) {
        if (element.elements) {
          allChildElements.push(...element.elements)
        }
      }

      const parsedChildren = filterParsedElements(allChildElements)
      const mergedElement: XmlElement = {
        type: 'element',
        name: tagName,
        attributes: firstElementAttributes,
        elements:
          allChildElements.length > 0
            ? (inlineCommonTags(parsedChildren) as XmlNode[])
            : undefined,
      }
      result.push(mergedElement)
    }
  }

  return result
}

export function applyRootTagTransformation(
  elements: ParsedLine[],
  options: {
    rootTag?: string
    noRootTag?: boolean
  } = {},
): ParsedLine[] {
  if (options.noRootTag) {
    return elements
  }

  const rootTagName = options.rootTag || 'document'

  const rootElement: XmlElement = {
    type: 'element',
    name: rootTagName,
    elements: elements,
  }

  return [rootElement]
}

export function applyIndentationTransformation(
  xml: string,
  indent: number = 2,
): string {
  if (indent === 0) {
    const lines = xml.split('\n')
    let tagNestingLevel = 0

    const unindentedLines = lines.map(line => {
      const trimmedLine = line.trimStart()

      if (trimmedLine.length === 0) {
        return ''
      }

      const isClosingTag = trimmedLine.startsWith('</')
      const isTag = trimmedLine.startsWith('<') && trimmedLine.endsWith('>')
      const isSelfClosingTag = trimmedLine.endsWith('/>')
      const isOpeningTag = isTag && !isClosingTag && !isSelfClosingTag

      if (isClosingTag) {
        tagNestingLevel--
      }

      if (isTag) {
        if (isOpeningTag) {
          tagNestingLevel++
        }
        return trimmedLine
      }

      const leadingSpaceCount = line.length - line.trimStart().length
      const spacesToPreserve = Math.max(0, leadingSpaceCount - tagNestingLevel)
      return ' '.repeat(spacesToPreserve) + trimmedLine
    })

    return unindentedLines.join('\n')
  }

  return xml
}

function kebabToPascal(str: string): string {
  const hasUpperCase = /[A-Z]/.test(str)
  if (hasUpperCase) return str

  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

export function applyTagCaseTransformation(
  elements: ParsedLine[],
  tagCase: 'kebab' | 'pascal' = 'kebab',
): ParsedLine[] {
  if (tagCase === 'kebab') {
    return elements
  }

  function transformElement(element: XmlElement): XmlElement {
    const transformedElement: XmlElement = {
      ...element,
      name: kebabToPascal(element.name),
    }

    if (element.elements) {
      transformedElement.elements = element.elements.map((child): XmlNode => {
        if (isXmlElement(child)) {
          return transformElement(child)
        }
        return child
      })
    }

    return transformedElement
  }

  return elements.map((element): ParsedLine => {
    if (element.type === 'element') {
      return transformElement(element)
    }
    return element
  })
}
