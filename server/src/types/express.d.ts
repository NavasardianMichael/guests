import type { OAuthFlowContext } from '../lib/oauth-state.js'
import type { ListOwner } from '../middleware/auth.js'
import type { SessionPayload } from '../lib/session.js'

declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload
      /** Set by `requireListOwner`: the account, or the guest key, a list route acts for. */
      listOwner?: ListOwner
      /** Set by `oauthStateStore.verify` once the Google `state` nonce has matched. */
      oauthFlow?: OAuthFlowContext
    }
  }
}

export {}
