import type { FormattedEmail } from '@payloadcms/plugin-form-builder/types'

const isSingleEmailAddress = (value: string): boolean =>
  /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/u.test(value)

export const enforceFormEmailRecipient = (
  emails: FormattedEmail[],
  recipient: string | undefined,
): FormattedEmail[] => {
  if (!recipient || !isSingleEmailAddress(recipient)) {
    throw new Error('FORM_BUILDER_DEFAULT_TO_EMAIL must be a single valid email address.')
  }

  return emails.map((email) => ({
    ...email,
    cc: '',
    bcc: '',
    to: recipient,
  }))
}
