import { ParsedLine, XmlElement, XmlNode } from './types.js'

function isXmlElement(node: XmlNode): node is XmlElement {
  return node.type === 'element'
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

    const hasOnlyElementChildren =
      textNodes.length === 0 && elementNodes.length === 0
    if (hasOnlyElementChildren && liftedElements.length > 0) {
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
