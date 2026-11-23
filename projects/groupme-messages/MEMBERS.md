# Separate GroupMe accounts

The owner continues using the existing Worker GroupMe secret. Jane's limited Dock workspace instead connects her own token from the project details page. It is verified against GroupMe's `/users/me`, stored only in her identity-scoped MemberAccount Durable Object, and omitted from all client responses. No credential is copied from the owner or stored in local/session storage. GroupMe chats, media requests, sends, reactions and notification alarms all use that same member credential.

Disconnecting or replacing the credential clears that member's watched chats and device subscriptions; reconnect notifications afterwards. Other Dock accounts are untouched. Account credentials are protected by the authenticated server, not end-to-end encryption from its operator. Tokens can be revoked in GroupMe. The Connect flow uses the official GroupMe Developer token because an OAuth flow compatible with the current Developer API has not been verified.

Display/read/saved-message preferences are separately synchronized. Owner preview has its own demo account namespace and does not show Jane's real chats. A stale page with a mismatched workspace fingerprint is rejected and must reload rather than silently using another account.
