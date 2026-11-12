import type { FormBlock as FormBlockProps } from '@/payload-types'
import { FormComponent } from './Form'
import RichText from '@/components/RichText'
import React from 'react'

export const FormBlock: React.FC<FormBlockProps> = ({ enableIntro, form, introContent }) => {
  if (!form || typeof form !== 'object') {
    return (
      <div className="container" role="alert">
        The form could not be loaded. Please contact the site administrator.
      </div>
    )
  }

  return (
    <div className="container">
      {enableIntro && introContent && (
        <RichText data={introContent} enableGutter={false} className="mb-8" />
      )}
      <FormComponent
        confirmationMessageContent={
          form.confirmationMessage ? (
            <RichText data={form.confirmationMessage} enableGutter={false} />
          ) : null
        }
        form={form}
        messageFieldContent={form.fields?.map((field, index) => {
          const key =
            field.blockType === 'message'
              ? field.id || `${field.blockType}-${index}`
              : field.name || `${field.blockType}-${index}`

          return field.blockType === 'message' && field.message ? (
            <RichText key={key} data={field.message} enableGutter={false} />
          ) : null
        })}
      />
    </div>
  )
}
