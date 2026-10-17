# Layerflow API for the app

The website and the app share **one server and one API**. Whatever a learner does in the app (solve a problem, take a hint, keep a streak, post in the community) shows up on the website, and the other way round.

```
                       https://your.domain
                              │  nginx (HTTPS)
              ┌───────────────┴────────────────┐
         /api/*  →  Fastify API :4000      everything else  →  Next.js website :3000
              ▲                                  ▲
        the APP calls this             browsers load the website
        (and so does the website)      (images like /people/priya.jpg live here too)
```

## 1. Basics

| | |
|---|---|
| **Base URL** | `https://your.domain/api` (the same domain as the website) |
| **HTTPS** | Required. Android blocks plain `http` by default and so does iOS (App Transport Security). |
| **Format** | JSON in, JSON out. Every error is `{"error": "a sentence you can show the user"}`. |
| **Start-up** | Call `GET /api/app/config` once. It returns the API version, the minimum app version, which features are on (AI mentor, voice, payments) and the asset paths. |
| **Images** | Use the website origin: `https://your.domain/people/priya.jpg` and so on (paths come from `/api/app/config`). |

### Who is the learner?

There are no passwords. A learner is a **pseudonym**: 2–40 characters, letters, digits, `_ . -` (for example `yash` or `ninja42`). The app stores it on the device and sends it as `learner_id`. **The same pseudonym means the same progress on the website and in the app.** Money actions (cash-out, goodies) are protected by a 4–6 digit wallet PIN (`/api/rewards/pin`).

### Native app vs web-based app

- **Native Android / iOS** (Kotlin, Swift, React Native, Flutter): the app sends no `Origin` header, so CORS doesn't apply. Just call the base URL.
- **Web-based app** (Expo web, Capacitor, Ionic, a PWA on `app.your.domain`): add its origin to `LAYERFLOW_CORS_ORIGINS` in the server's `.env`, e.g. `LAYERFLOW_CORS_ORIGINS=https://app.your.domain,capacitor://localhost,http://localhost`.

### Limits

Per device (IP), per minute: **60** AI and voice calls (chat, answer, mentor session, voice, repo or website analyse) and **150** code runs (submit, hint, replay, bug reports). Over the limit you get **HTTP 429** with a `Retry-After` header (in seconds) and a friendly message. Free-plan daily limits apply on top: 20 chats, 2 mentor calls and 3 analyses (Pro removes them).

## 2. The learning loop

| Step | Call | Notes |
|---|---|---|
| List problems | `GET /api/challenges` | `{challenges: [{id, title, signature, difficulty, concepts, visible_count, hidden_count}], …}` |
| Open one | `GET /api/challenges/:id` | `description`, `inputs`, `starter` code, `visible` examples. Hidden tests are never sent. |
| Run code | `POST /api/submit` `{learner_id, challenge_id, code}` | `visible[]` rows, `hidden[]` as `{test, outcome}` only, `mistake_tags`, `explanation`, `debug.culprit_line` and `debug.reason` (the Line Map) |
| Hint 1–3 | `POST /api/hint` `{submission_id, message?}` | `{rung, rung_name, hint, remaining, source}`. Prose only, written for the learner's code. `remaining: 0` after the 3rd. |
| The answer | `POST /api/answer` `{submission_id}` | Only after all 3 hints (`403` before). `{whats_wrong, what_changed, fixed_code, diff[], tests_passed, source}`. The fixed code passed every visible and hidden test before it was sent. |
| Watch it run | `POST /api/replay` `{submission_id}` | `steps[{step, line, locals, note?, flag?}]`, run on a safe public input |
| Progress | `GET /api/learner/:id` | mastery per concept, recurring mistakes, next problem and why, streak, history |
| Reload a result | `GET /api/submissions/:id` | code, results, hints given, and the answer if it was opened |

Outcomes are always one of `passed`, `wrong_output`, `runtime_error` or `timeout`.

## 3. Priya: mentor, chat and voice

| Call | Notes |
|---|---|
| `GET /api/mentor/:learner` | recent problems, what went wrong in each, recurring mistakes, the next pick |
| `POST /api/mentor/session` `{learner_id, challenge_id, lang?}` | the narrated session: `segments[{title, say, speech, visual}]` and `trace` for the animated Summarise. `lang` is `en`, `hi` or `mr`. |
| `POST /api/chat` `{message, learner_id?, history?, lang?, context?: {page, challenge_id?, code?}}` | `{reply, suggestions[], source, model}`. On a problem it never writes code. |
| `GET /api/voice/status` | which voice is live (`elevenlabs` or `browser`) |
| `POST /api/voice/tts` `{text}` | `audio/mpeg`, or **204** = use the phone's own text-to-speech |
| `POST /api/voice/stt` (raw audio body, ≤ 8 MB, `content-type: audio/webm`, `audio/mp4`, …) | `{text}`, or **204** = use the phone's own speech recognition |

## 4. Community, Repo/Website Analyse, Rewards, Bug Bounty

| Area | Calls |
|---|---|
| Community | `GET /api/community/posts?viewer=…&kind=…` · `GET /api/community/posts/:id?viewer=…` · `POST /api/community/posts` `{author_id, kind, title, body, challenge_id?}` · `POST /api/community/posts/:id/replies` `{author_id, body}` · `POST /api/community/vote` `{voter_id, target, id, value}` · `POST /api/community/posts/:id/accept` `{actor_id, reply_id}` |
| Profile | `GET /api/profile/:id` · `POST /api/profile` `{id, display_name?, role?, bio?}` |
| Repo / Website Analyse | `POST /api/repo/analyze` `{url}` · `POST /api/site/analyze` `{url}` · `GET /api/repo/reports?learner_id=…` |
| Rewards | `GET /api/rewards/:id` · `GET /api/rewards/:id/summary` (for a header chip) · `POST /api/rewards/pin` `{learner_id, pin}` · `POST /api/rewards/redeem` `{learner_id, pin, kind: "cash"\|"goodie", points?, upi_id?, item_id?, size?, shipping?}` |
| Bug Bounty | `GET /api/bounty/programs` · `GET /api/bounty/programs/:id` · `POST /api/bounty/reports` `{program_id, learner_id, title, category, severity, description, file?, line?, steps?, impact?, fix?}` · `GET /api/bounty/explainer` |

## 5. Plans and payments (Razorpay)

1. `GET /api/plans`: the plans and prices (Free, Pro at ₹349 or $4 a month, Custom).
2. `POST /api/plans/checkout` `{learner_id, currency: "INR"|"USD"}` returns `{mode, payment, razorpay}`:
   - `mode: "razorpay"`: open the **Razorpay mobile SDK** with the `razorpay` options (key, order id, amount, currency).
   - `mode: "demo"`: payments aren't switched on yet (test server). Show `demo_checkout` instead.
3. When Razorpay returns success, call `POST /api/payments/razorpay/verify` `{payment, razorpay_order_id, razorpay_payment_id, razorpay_signature}`. The server checks the signature and adds 30 days of Pro.

Pro is prepaid (no auto-debit). Each payment adds 30 days.

## 6. Errors you should handle

| Status | Meaning | What to show |
|---|---|---|
| 400 | a field is missing or invalid | the `error` text |
| 403 | not allowed yet (e.g. the answer before all hints) | the `error` text |
| 404 | unknown id | "Not found" |
| 429 | too many requests from this device, or a Free daily limit | the `error` text; retry after `Retry-After` seconds |
| 503 | the sandbox is busy | "Busy — try again in a moment" |

## 7. Server settings for the app (`.env`)

```
LAYERFLOW_PUBLIC_URL=https://your.domain       # returned to the app as web_url
LAYERFLOW_CORS_ORIGINS=                         # only for web-based apps, comma-separated
LAYERFLOW_MIN_APP_VERSION=1.0.0                 # the app can ask users to update below this
LAYERFLOW_RATE_AI=60                            # per device, per minute
LAYERFLOW_RATE_RUN=150
LAYERFLOW_ADMIN_TOKEN=                          # admin desk + reset (keep it secret)
```
