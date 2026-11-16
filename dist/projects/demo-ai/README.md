# Demo AI

A local-only experiment using the browser's built-in LanguageModel (Prompt API). Hub → Demo AI → Run → Start local session. It is not Qwen/Dolphin, a hosted model, or a canned-response demo.

This project only calls create() after availability() reports `available`, checked again on every session start. It never creates a session in `downloadable`, `downloading`, `unavailable`, or unsupported states. A download-progress callback aborts session creation if availability changes during startup. There is no model-download button, model-weight URL, external SDK, polyfill, provider key/account, or cloud fallback. Normal web assets still load. The browser can manage/update/download its own model independently of this app, so the project cannot guarantee zero browser-managed background downloads.

A local model necessarily occupies disk/memory on the device. If no ready built-in model is present, this app cannot chat. Browser/device/version/policy/language compatibility varies; do not promise support on phones, Safari or Firefox. Consult https://developer.chrome.com/docs/ai/prompt-api .

English text only. Supports streamed local replies, Stop, fresh sessions, copy response, and light/dark mode. History is memory-only and cleared on reload. Stop destroys the local session; a new session rebuilds context from completed exchanges only. The app reports local context errors and browser context-overflow events. Model text is rendered via textContent, not HTML. No prompts are sent through app code to an AI server. The existing Cloudflare gate protects page loading; inference is on-device.

Tests mock LanguageModel to cover readiness states and controls; they do not prove that the user's device has a compatible built-in model. No model is downloaded during tests.
