import type { Page, ReusableContentBlock, Template } from '@/payload-types'
import { buildPageSearchText } from '@/search/buildPageSearchText'
import type { PayloadRequest, Where } from 'payload'

type SearchIndexUpdateOptions = {
  collection: 'search'
  data: { searchableText: string }
  overrideAccess: true
  req: PayloadRequest
  where: Where
}

type SearchIndexUpdate = (
  options: SearchIndexUpdateOptions,
) => Promise<{
  docs: unknown[]
  errors: { message: string }[]
}>

function getTemplateID(template: string | Template): string {
  return typeof template === 'string' ? template : template.id
}

function usesTemplateValues(block: ReusableContentBlock, templateID: string): boolean {
  return block.useTemplateValues === true && getTemplateID(block.template) === templateID
}

export async function refreshPagesUsingTemplate({
  templateID,
  template,
  req,
}: {
  templateID: string
  template?: Template
  req: PayloadRequest
}): Promise<void> {
  if (template && template.id !== templateID) {
    throw new Error(
      `Template ID mismatch: expected '${templateID}', received '${template.id}'.`,
    )
  }

  const templatesByID = new Map<string, Template>()
  if (template) {
    templatesByID.set(templateID, template)
  }

  // The Search collection is registered dynamically by the plugin and is absent
  // from the generated collection types until they are regenerated.
  const updateSearchIndex = req.payload.update.bind(req.payload) as unknown as SearchIndexUpdate

  let pageNumber = 1

  while (true) {
    const result = await req.payload.find({
      collection: 'pages',
      depth: 0,
      draft: false,
      limit: 100,
      overrideAccess: false,
      page: pageNumber,
      req,
      where: {
        and: [
          { _status: { equals: 'published' } },
          { 'layout.template': { equals: templateID } },
        ],
      },
    })

    for (const page of result.docs) {
      const activeReusableBlocks = page.layout.filter(
        (block): block is ReusableContentBlock =>
          block.blockType === 'reusableContent' &&
          usesTemplateValues(block, templateID),
      )

      if (activeReusableBlocks.length === 0) {
        continue
      }

      const templateIDs = new Set(
        page.layout.flatMap((block) =>
          block.blockType === 'reusableContent' && block.useTemplateValues
            ? [getTemplateID(block.template)]
            : [],
        ),
      )

      for (const usedTemplateID of templateIDs) {
        if (usedTemplateID === templateID) {
          if (template) {
            templatesByID.set(usedTemplateID, template)
          }
          continue
        }

        if (!templatesByID.has(usedTemplateID)) {
          const usedTemplate = await req.payload.findByID({
            collection: 'templates',
            depth: 0,
            id: usedTemplateID,
            overrideAccess: false,
            req,
          })

          templatesByID.set(usedTemplateID, usedTemplate)
        }
      }

      const pageForSearch: Page = {
        ...page,
        layout: page.layout.map((block) =>
          block.blockType === 'reusableContent' && typeof block.template !== 'string'
            ? { ...block, template: block.template.id }
            : block,
        ),
      }

      const updateResult = await updateSearchIndex({
        collection: 'search',
        data: {
          searchableText: buildPageSearchText(pageForSearch, templatesByID),
        },
        overrideAccess: true,
        req,
        where: {
          and: [
            { 'doc.relationTo': { equals: 'pages' } },
            { 'doc.value': { equals: page.id } },
          ],
        },
      })

      if (updateResult.errors.length > 0) {
        const messages = updateResult.errors.map(({ message }) => message).join('; ')
        throw new Error(
          `Failed to refresh Search index for Page '${page.id}': ${messages}`,
        )
      }

      if (updateResult.docs.length === 0) {
        console.warn(
          `Search index entry is missing for Page '${page.id}'; it was not created automatically.`,
        )
      }
    }

    if (!result.hasNextPage) {
      break
    }

    pageNumber += 1
  }
}
