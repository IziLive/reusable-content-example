import { describe, expect, it } from 'vitest'
import { enforceFormEmailRecipient } from '@/hooks/enforceFormEmailRecipient'
import type { FormattedEmail } from '@payloadcms/plugin-form-builder/types'

const email = {
  bcc: 'attacker@example.net',
  cc: 'attacker@example.org',
  from: 'noreply@example.com',
  html: '<p>Message</p>',
  replyTo: 'sender@example.com',
  subject: 'Contact form submission',
  to: 'attacker@example.net',
} satisfies FormattedEmail

describe('Form Builder email recipient enforcement', () => {
  it('replaces configured recipients with the fixed server recipient', () => {
    expect(enforceFormEmailRecipient([email], 'inbox@example.com')).toEqual([
      { ...email, bcc: '', cc: '', to: 'inbox@example.com' },
    ])
  })

  it.each([
    undefined,
    '',
    'not-an-email',
    'first@example.com,second@example.com',
    'inbox@example.com\r\nBcc: attacker@example.net',
  ])('rejects an invalid or missing recipient (%s)', (recipient) => {
    expect(() => enforceFormEmailRecipient([email], recipient)).toThrow(
      'FORM_BUILDER_DEFAULT_TO_EMAIL must be a single valid email address.',
    )
  })
})
