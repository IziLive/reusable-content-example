'use client'

import type { Form as PayloadForm } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import React, { useState, type FormEvent, type ReactNode } from 'react'

type FormField = NonNullable<PayloadForm['fields']>[number]

const getErrorMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined

  if ('message' in data && typeof data.message === 'string') {
    return data.message
  }

  if ('errors' in data && Array.isArray(data.errors)) {
    const messages = data.errors.flatMap((error: unknown) => {
      if (error && typeof error === 'object' && 'message' in error) {
        return typeof error.message === 'string' ? [error.message] : []
      }

      return []
    })

    if (messages.length > 0) return messages.join(' ')
  }

  return undefined
}

const FormFieldInput: React.FC<{ field: FormField; messageContent?: ReactNode }> = ({
  field,
  messageContent,
}) => {
  if (field.blockType === 'message') {
    return messageContent ?? null
  }

  const label = field.label || field.name

  if (field.blockType === 'checkbox') {
    return (
      <label className="flex items-center gap-2">
        <Input
          className="h-4 w-4"
          defaultChecked={field.defaultValue ?? false}
          name={field.name}
          required={field.required ?? false}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
    )
  }

  if (field.blockType === 'textarea') {
    return (
      <label className="flex flex-col gap-2">
        <span>{label}</span>
        <Textarea
          defaultValue={field.defaultValue ?? ''}
          name={field.name}
          required={field.required ?? false}
        />
      </label>
    )
  }

  if (field.blockType === 'select') {
    return (
      <label className="flex flex-col gap-2">
        <span>{label}</span>
        <select
          className="flex h-10 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          defaultValue={field.defaultValue ?? ''}
          name={field.name}
          required={field.required ?? false}
        >
          <option value="">{field.placeholder || 'Select an option'}</option>
          {field.options?.map((option) => (
            <option key={option.id ?? option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const inputType =
    field.blockType === 'email' ? 'email' : field.blockType === 'number' ? 'number' : 'text'
  const defaultValue = 'defaultValue' in field ? field.defaultValue ?? '' : ''

  return (
    <label className="flex flex-col gap-2">
      <span>{label}</span>
      <Input
        defaultValue={defaultValue}
        name={field.name}
        required={field.required ?? false}
        type={inputType}
      />
    </label>
  )
}

export const FormComponent: React.FC<{
  confirmationMessageContent?: ReactNode
  form: PayloadForm
  messageFieldContent?: (ReactNode | null)[]
}> = ({ confirmationMessageContent, form, messageFieldContent }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isSubmitted, setIsSubmitted] = useState(false)
  const fields = form.fields ?? []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(undefined)

    if (form.confirmationType === 'redirect' && !form.redirect?.url) {
      setErrorMessage('This form is configured to redirect, but no redirect URL is set.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const submissionData = fields.flatMap((field) => {
      if (field.blockType === 'message') return []

      if (field.blockType === 'checkbox') {
        return [{ field: field.name, value: String(formData.get(field.name) === 'on') }]
      }

      const value = String(formData.get(field.name) ?? '')
      if (!value && !field.required) return []
      return [{ field: field.name, value }]
    })

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          form: form.id,
          submissionData,
        }),
      })

      const responseText = await response.text()
      let responseData: unknown

      try {
        responseData = JSON.parse(responseText)
      } catch {
        throw new Error(
          response.ok
            ? 'The form submission returned an invalid response.'
            : `The form submission failed with status ${response.status}.`,
        )
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(responseData) ||
            `The form submission failed with status ${response.status}.`,
        )
      }

      if (form.confirmationType === 'redirect' && form.redirect?.url) {
        window.location.assign(form.redirect.url)
        return
      }

      setIsSubmitted(true)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The form could not be submitted. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return confirmationMessageContent ?? (
      <p role="status">Thank you. Your submission has been received.</p>
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {fields.map((field, index) => (
        <FormFieldInput
          field={field}
          key={'id' in field && field.id ? field.id : `${field.blockType}-${index}`}
          messageContent={messageFieldContent?.[index]}
        />
      ))}
      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
      <div>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Submitting…' : form.submitButtonLabel || 'Submit'}
        </Button>
      </div>
    </form>
  )
}
