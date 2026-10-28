# RecoverFlow AI

An MVP for Code E Fiesta 2026, Problem Statement 4: **The Self-Healing AI Automation System**.

## What the demo proves

1. A live workflow monitor shows a healthy Order → CRM automation.
2. **Inject schema failure** creates a realistic failed CRM action and execution logs.
3. **Run AI diagnosis** calls the server-side Groq route (or uses the safe local demo diagnosis if no key is configured).
4. A human approves a small, reversible field-mapping patch.
5. **Validate & retry** replays the event, verifies the result, and records a successful recovery.

This deliberately uses simulated business systems so the complete failure-to-recovery story can be demonstrated safely in six hours.

## Local run

```bash
npm install
copy .env.example .env.local
# Add GROQ_API_KEY only if you want a live Groq diagnosis.
npm run dev
```

Open the local URL printed by Vite. The full flow still works without an API key; it labels that result as a local demo diagnosis.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Set `GROQ_API_KEY` as a **Secret** for Preview and Production. Never use a `VITE_` prefix.
3. Optionally set `GROQ_MODEL` to a model enabled in the Groq account.
4. Deploy, then test the workflow end-to-end in an incognito window.

## Demo script

Start at the healthy monitor. Inject the schema failure. Point to the evidence and explain that automatic retry is intentionally paused. Run the diagnosis, approve the narrow patch, validate it, and show the recovered CRM step plus the audit trail.

## Security notes

- The Groq key is accessed only in `api/diagnose.js` on the server.
- `.env.local` is gitignored; `.env.example` contains no secrets.
- The endpoint limits input length and falls back safely if the model is unavailable.

