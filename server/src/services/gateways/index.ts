import { ameriaGateway } from './ameria.js'
import { mockGateway } from './mock.js'
import type { PaymentGatewayClient } from './types.js'
import type { PaymentGatewayId } from '../../config.js'

/** Adding a gateway: a client file here, one entry, and a value in the Prisma enum. */
export const GATEWAYS: Record<PaymentGatewayId, PaymentGatewayClient> = {
  ameria: ameriaGateway,
  mock: mockGateway,
}

export const isGatewayId = (value: unknown): value is PaymentGatewayId =>
  typeof value === 'string' && Object.hasOwn(GATEWAYS, value)
