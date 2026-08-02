# AI Money Mentor

A personal finance assistant for Indian users — combines a real, tested tax-regime calculator with an LLM-powered chat interface for investment and SIP (mutual fund) guidance.

**Live focus:** Old vs New income tax regime comparison, SIP wealth projection, and conversational financial Q&A.

## What's actually deterministic vs. AI-generated

This project is explicit about where hard numbers come from, because financial tools that let an LLM freehand tax math are a real risk:

| Feature | How it works |
|---|---|
| Old vs New tax regime comparison | **Computed in code** (server/taxCalculator.ts) using the actual FY 2025-26/2026-27 slab rates, standard deduction, and Section 87A rebate rules. Fully unit tested - server/taxCalculator.test.ts, 8 tests covering both regimes and edge cases. |
| SIP wealth/compounding calculator | **Computed in code**, standard SIP future-value formula, real-time as you adjust the sliders. |
| Chat responses about tax | The backend detects tax-related questions, runs the real calculator first, and passes the computed numbers into the LLM prompt - the model explains the numbers, it does not calculate them. |
| Authentication & chat history | Real accounts (bcrypt-hashed passwords, JWT sessions) backed by SQLite. Chat history persists per user across logins - server/auth.ts, server/auth.test.ts, 6 tests. |
| General investment/planning conversation | LLM-generated (Gemini), conversational - treat as a starting point for discussion, not financial advice. |

## Features

- **Tax Regime Comparator** - enter your income, get an exact Old vs New regime breakdown with bracket-by-bracket detail, rebate application, and cess, backed by POST /api/tax/compare.
- **SIP Explorer** - browse government/private mutual funds, filter by risk and category, compare up to 3 side by side, and run a compounding wealth calculator.
- **AI Chat Advisor** - ask free-form questions about taxes, investments, or retirement planning; tax-related questions are grounded in the real calculator output before the model responds. Conversation history persists across sessions.
- **Real Authentication** - email/password accounts with bcrypt password hashing and JWT-based sessions.
- **Export to PDF** - download your chat/plan as a shareable PDF.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend:** Express, TypeScript (via tsx), SQLite (better-sqlite3)
- **Auth:** bcrypt password hashing, JWT sessions
- **AI:** Google Gemini (gemini-3-flash-preview)
- **Testing:** Vitest (14 tests across tax calculator and auth logic)

## Getting Started

```bash
npm install
cp .env.example .env   # add your VITE_GEMINI_API_KEY and a JWT_SECRET
npm run dev             # runs client (Vite) + server (Express) together
```

Run the test suite:
```bash
npm test
```

## API

- `POST /api/signup` — create an account (fullName, email, password, optional phone/income)
- `POST /api/login` — log in, returns a JWT
- `GET /api/me` — get the current authenticated user (requires Bearer token)
- `GET /api/messages` — get persisted chat history for the current user (requires Bearer token)
- `GET /api/sips` — list available SIP funds
- `GET /api/sips/:id` — get a single fund
- `POST /api/chat` — send a message (requires Bearer token); tax-related queries are automatically routed through the real tax calculator first
- `POST /api/tax/compare` — directly compare Old vs New regime tax for a given income

```bash
curl -X POST http://localhost:3001/api/tax/compare \
  -H "Content-Type: application/json" \
  -d '{"annualIncome": 1200000}'
```

## Known Limitations

Being upfront about what this doesn't do yet:
- The tax calculator covers salaried individuals under 60, slab tax + cess only — it does not account for surcharge on incomes above ₹50L or capital gains taxation.
- No password reset flow yet.
- This is a portfolio/learning project, not a substitute for a certified tax advisor or financial planner.

## License

MIT — see [LICENSE](LICENSE).
