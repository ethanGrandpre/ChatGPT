# AI Assistant

Hub → AI Assistant → Run. Browser-only text chat backed by Puter.js online AI, with streamed responses, model selection, device-local conversation history, title search, new/delete chat, copy/export, retry/stop and light/dark mode. No local model download, API key entry or Mac server is required. The SDK is loaded from https://js.puter.com/v2/ .

Puter authentication may be required. Model availability, allowances, charges and rate limits are controlled by Puter and the user's provider account. This is keyless, not a promise of unlimited free usage. Provider documentation: https://docs.puter.com/AI/chat/ and https://docs.puter.com/user-pays-model/ .

On Send, the current chat context and a system instruction are sent to Puter/the selected model provider. Other chats and hub project data are not included in that request. Because the provider SDK executes on this origin, only use a trusted SDK; it has the same browser privileges as other page scripts. Browser storage is not encrypted cloud storage, and chats do not synchronize across devices. Nothing in this app requires an API key, and it never stores one.

Stop aborts receipt of output and discards any late output in the UI. Puter documents that upstream generation can finish and remain billable after cancellation. Changing or deleting chats is disabled during generation. Saved interrupted streams are restored as stopped, not left permanently pending. Text and code are rendered as text, never executable model-generated HTML. Context length is bounded and the app asks for a new chat rather than silently dropping old messages.

This is a chat assistant, not the ChatGPT product. It has no browsing, file access, code execution, or agent actions. Live provider responses depend on provider sign-in and account/model access; tests use a mock stream to avoid consuming the user's credits.
