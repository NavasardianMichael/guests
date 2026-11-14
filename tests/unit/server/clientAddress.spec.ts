import { describe, expect, it } from 'vitest'
import { clientAddress } from '../../../server/src/lib/request'

describe('clientAddress', () => {
  it('keeps an IPv4 address as it is', () => {
    expect(clientAddress({ ip: '203.0.113.7' })).toBe('203.0.113.7')
  })

  it('reads an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientAddress({ ip: '::ffff:203.0.113.7' })).toBe('203.0.113.7')
  })

  it('folds an IPv6 address to its /64, so rotating inside it does not reset a limit', () => {
    const a = clientAddress({ ip: '2001:db8:aa:bb:1:2:3:4' })
    const b = clientAddress({ ip: '2001:db8:aa:bb:ffff:ffff:ffff:ffff' })
    expect(a).toBe('2001:db8:aa:bb::/64')
    expect(b).toBe(a)
    expect(clientAddress({ ip: '2001:db8:aa:cc::1' })).not.toBe(a)
  })

  it('expands a compressed IPv6 address before taking the prefix', () => {
    expect(clientAddress({ ip: '2001:db8::1' })).toBe('2001:db8:0:0::/64')
    expect(clientAddress({ ip: 'fe80::1%eth0' })).toBe('fe80:0:0:0::/64')
  })

  it('names a missing address', () => {
    expect(clientAddress({})).toBe('unknown')
  })
})
