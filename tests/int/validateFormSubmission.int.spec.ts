import { describe, expect, it } from 'vitest'
import {
  validateFormSubmission,
  validateFormSubmissionBeforeChange,
} from '@/hooks/validateFormSubmission'

const form = {
  fields: [
    { blockType: 'text', name: 'name', required: true },
    { blockType: 'email', name: 'email', required: true },
    { blockType: 'number', name: 'age', required: true },
    {
      blockType: 'select',
      name: 'color',
      options: [
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' },
      ],
      required: true,
    },
    {
      blockType: 'radio',
      name: 'size',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Large', value: 'large' },
      ],
      required: true,
    },
    { blockType: 'checkbox', name: 'consent', required: true },
    { blockType: 'message', message: {} },
  ],
}

const validSubmission = [
  { field: 'name', value: 'Ada' },
  { field: 'email', value: 'ada@example.com' },
  { field: 'age', value: '37' },
  { field: 'color', value: 'blue' },
  { field: 'size', value: 'small' },
  { field: 'consent', value: 'true' },
]

describe('Form Builder submission validation', () => {
  it('accepts a valid submission', () => {
    expect(validateFormSubmission(form, validSubmission)).toBeUndefined()
  })

  it('rejects a missing required field', () => {
    const submission = validSubmission.filter((answer) => answer.field !== 'name')

    expect(validateFormSubmission(form, submission)).toContain('required')
  })

  it('rejects an invalid email address', () => {
    const submission = validSubmission.map((answer) =>
      answer.field === 'email' ? { ...answer, value: 'not-an-email' } : answer,
    )

    expect(validateFormSubmission(form, submission)).toContain('email address')
  })

  it('rejects a non-numeric number field', () => {
    const submission = validSubmission.map((answer) =>
      answer.field === 'age' ? { ...answer, value: 'many' } : answer,
    )

    expect(validateFormSubmission(form, submission)).toContain('number')
  })

  it.each([
    ['select', 'color', 'green'],
    ['radio', 'size', 'extra-large'],
  ])('rejects a disallowed %s option', (_type, field, value) => {
    const submission = validSubmission.map((answer) =>
      answer.field === field ? { ...answer, value } : answer,
    )

    expect(validateFormSubmission(form, submission)).toContain('not allowed')
  })

  it('rejects an unknown field name', () => {
    const submission = [...validSubmission, { field: 'admin', value: 'true' }]

    expect(validateFormSubmission(form, submission)).toContain('does not exist')
  })

  it('rejects a repeated field name', () => {
    const submission = [...validSubmission, { field: 'name', value: 'Grace' }]

    expect(validateFormSubmission(form, submission)).toContain('more than once')
  })

  it('rejects an unknown configured field type', () => {
    const unknownTypeForm = {
      fields: [{ blockType: 'attachment', name: 'file', required: true }],
    }

    expect(
      validateFormSubmission(unknownTypeForm, [{ field: 'file', value: 'file.pdf' }]),
    ).toContain('unsupported field type')
  })

  it('rejects a payment field type', () => {
    const paymentForm = {
      fields: [{ blockType: 'payment', name: 'payment', required: true }],
    }

    expect(
      validateFormSubmission(paymentForm, [{ field: 'payment', value: '100' }]),
    ).toContain('unsupported field type')
  })

  it('accepts a submission when the form is on a published page', async () => {
    const data = {
      form: 'form-1',
      submissionData: validSubmission,
    }
    const formFind = async () => form
    const pagesFind = async () => ({ docs: [{ id: 'page-1' }] })

    const result = await validateFormSubmissionBeforeChange({
      data,
      req: {
        payload: {
          find: pagesFind,
          findByID: formFind,
        },
      },
    } as never)

    expect(result).toBe(data)
  })

  it('rejects a submission when the form is not on a published page', async () => {
    const formFind = async () => form
    const pagesFind = async () => ({ docs: [] })

    await expect(
      validateFormSubmissionBeforeChange({
        data: {
          form: 'form-1',
          submissionData: validSubmission,
        },
        req: {
          payload: {
            find: pagesFind,
            findByID: formFind,
          },
        },
      } as never),
    ).rejects.toThrow('This form is not available for public submissions.')
  })
})
