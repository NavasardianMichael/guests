import type { Endpoint } from '@interfaces/api'
import type { TemplateId } from '@constants/templates'

export type OwnedTemplatesResponse = { templates: string[] }
export type GetOwnedTemplatesAPI = Endpoint<{ payload: void; response: OwnedTemplatesResponse; processed: TemplateId[] }>

/** `listId`: the saved list the purchase starts from (the result page leads back to it); absent for a draft. */
export type CheckoutPayload = { templateId: TemplateId; listId?: string }
export type CheckoutResponse = { checkoutUrl: string }
export type CheckoutTemplateAPI = Endpoint<{ payload: CheckoutPayload; response: CheckoutResponse; processed: string }>
