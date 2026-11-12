import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { FormSubmission } from '@/payload-types'

type FormFieldConfig = Record<string, unknown>

const supportedFieldTypes = new Set([
  'checkbox',
  'country',
  'date',
  'email',
  'message',
  'number',
  'radio',
  'select',
  'state',
  'text',
  'textarea',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)

const isNumber = (value: string): boolean =>
  /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value) &&
  Number.isFinite(Number(value))

export const validateFormSubmission = (
  form: unknown,
  submissionData: unknown,
): string | undefined => {
  if (!isRecord(form)) return 'The selected form configuration is invalid.'

  const configuredFields = form.fields
  if (
    configuredFields !== undefined &&
    configuredFields !== null &&
    !Array.isArray(configuredFields)
  ) {
    return 'The selected form configuration is invalid.'
  }

  const submittedAnswers =
    submissionData === undefined || submissionData === null ? [] : submissionData
  if (!Array.isArray(submittedAnswers)) return 'Submission data must be an array.'

  const fieldsByName = new Map<string, FormFieldConfig>()

  for (const configuredField of configuredFields ?? []) {
    if (!isRecord(configuredField)) return 'The selected form configuration is invalid.'

    const blockType = configuredField.blockType
    if (typeof blockType !== 'string' || !supportedFieldTypes.has(blockType)) {
      return `The selected form contains an unsupported field type: ${String(blockType)}.`
    }

    if (blockType === 'message') continue

    const name = configuredField.name
    if (typeof name !== 'string' || name.length === 0) {
      return 'The selected form contains a field without a valid name.'
    }
    if (fieldsByName.has(name)) {
      return `The selected form contains duplicate field names: ${name}.`
    }

    fieldsByName.set(name, configuredField)
  }

  const submittedFields = new Set<string>()
  const valuesByName = new Map<string, string>()

  for (const item of submittedAnswers) {
    if (!isRecord(item)) return 'Each submitted answer must be an object.'

    const name = item.field
    const value = item.value
    if (typeof name !== 'string' || name.length === 0 || typeof value !== 'string') {
      return 'Each submitted answer must include a field name and a string value.'
    }
    if (!fieldsByName.has(name)) {
      return `The submitted field does not exist in this form: ${name}.`
    }
    if (submittedFields.has(name)) {
      return `The submitted field appears more than once: ${name}.`
    }

    submittedFields.add(name)
    valuesByName.set(name, value)
  }

  for (const [name, field] of fieldsByName) {
    const required = field.required === true
    const value = valuesByName.get(name)

    if (required && value === undefined) {
      return `A value is required for the field: ${name}.`
    }
    if (value === undefined) continue
    if (required && value.trim().length === 0) {
      return `A value is required for the field: ${name}.`
    }

    switch (field.blockType) {
      case 'checkbox':
        if (value !== 'true' && value !== 'false') {
          return `The submitted checkbox value is invalid: ${name}.`
        }
        if (required && value !== 'true') {
          return `The required checkbox must be selected: ${name}.`
        }
        break
      case 'email':
        if (value.length > 0 && !isEmail(value)) {
          return `The submitted email address is invalid: ${name}.`
        }
        break
      case 'number':
        if (value.length > 0 && !isNumber(value)) {
          return `The submitted number is invalid: ${name}.`
        }
        break
      case 'radio':
      case 'select': {
        if (value.length === 0 && !required) break

        const options = field.options
        if (!Array.isArray(options)) {
          return `The configured options are invalid for the field: ${name}.`
        }

        const allowedValues = new Set<string>()
        for (const option of options) {
          if (!isRecord(option) || typeof option.value !== 'string') {
            return `The configured options are invalid for the field: ${name}.`
          }
          allowedValues.add(option.value)
        }

        if (!allowedValues.has(value)) {
          return `The submitted option is not allowed for the field: ${name}.`
        }
        break
      }
    }
  }

  return undefined
}

export const validateFormSubmissionBeforeChange: CollectionBeforeChangeHook<FormSubmission> =
  async ({ data, req }) => {
    const formReference = data.form
    const formID =
      typeof formReference === 'string'
        ? formReference
        : isRecord(formReference) && typeof formReference.id === 'string'
          ? formReference.id
          : undefined

    if (!formID) {
      throw new APIError('A valid form is required for this submission.', 400, null, true)
    }

    const form = await req.payload.findByID({
      collection: 'forms',
      id: formID,
      depth: 0,
      overrideAccess: false,
      req,
    })
    const validationError = validateFormSubmission(form, data.submissionData)

    if (validationError) {
      throw new APIError(validationError, 400, null, true)
    }

    const publishedPage = await req.payload.find({
      collection: 'pages',
      depth: 0,
      draft: false,
      limit: 1,
      overrideAccess: false,
      req,
      where: {
        and: [
          { _status: { equals: 'published' } },
          { 'layout.form': { equals: formID } },
        ],
      },
    })

    if (publishedPage.docs.length === 0) {
      throw new APIError(
        'This form is not available for public submissions.',
        400,
        null,
        true,
      )
    }

    return data
  }
