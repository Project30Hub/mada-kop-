# 🌿 MadaKop — Healing Hub & Private Cannabis Club

> *Small Farm, Evaton, Sebokeng · Est. 2025 · One Love Family*

[![Live Site](https://img.shields.io/badge/Live%20Site-madakop.vercel.app-bfff3c?style=for-the-badge&logo=vercel&logoColor=black)](https://madakop.vercel.app)
[![Powered by Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![AI Chatbot](https://img.shields.io/badge/Chatbot-Claude%20AI-e91e8c?style=for-the-badge&logo=anthropic&logoColor=white)](https://anthropic.com)

---

## What is MadaKop?

MadaKop is a private cannabis club and healing hub based in Evaton, Sebokeng, South Africa. This repository contains the full website — a membership platform with a product menu, loyalty rewards system, events, rolling tutorials, AI chatbot, and a live admin dashboard.

---

## Pages

| Page | Description |
|---|---|
| `index.html` | Homepage — shop, events, delivery info, club rules, AI chatbot |
| `register.html` | 3-step membership registration — saves to Supabase |
| `login.html` | Member sign-in via unique MK-XXXXXX code |
| `members.html` | Live dashboard — points, tier progress, activity log |
| `rewards.html` | Loyalty tiers, points system, rewards shop |
| `strain-finder.html` | 5-question quiz to find your perfect strain |
| `tutorials.html` | Step-by-step rolling tutorials (Beginner → Advanced) |
| `admin.html` | Admin panel — manage members, award points, export CSV |
| `api/chat.js` | Vercel serverless function — Claude AI proxy (keeps API key secure) |

---

## Tech Stack

- **Frontend** — Pure HTML, CSS, JavaScript (no frameworks)
- **Backend** — [Supabase](https://supabase.com) (PostgreSQL database + REST API)
- **AI Chatbot** — [Claude API](https://anthropic.com) via Vercel serverless function
- **Hosting** — [Vercel](https://vercel.com)
- **Fonts** — Google Fonts (Bebas Neue, DM Sans, Space Mono)

---

## Features

### 🤖 AI Chatbot
- Powered by Claude (claude-sonnet-4-20250514)
- Handles membership, strain, delivery and ordering questions
- API key stored securely in Vercel — never exposed in code
- Fallback to WhatsApp if connection fails

### 🪪 Membership System
- Members register and receive a unique **MK-XXXXXX** code
- Code is stored permanently in Supabase
- Login works from any device using the code
- 3 tiers: **Basic** (Free) · **Gold** (R189/mo) · **VIP** (R379/mo)

### ⭐ MK Points & Rewards
- Points auto-awarded on registration (50 welcome points)
- Points tracked in a live log per member
- Tier auto-upgrades based on point total:
  - Bronze → Silver: 1,000 pts
  - Silver → Gold: 3,000 pts
  - Gold → VIP: 8,000 pts

### 🛠️ Admin Dashboard
- View all members in a searchable, filterable table
- Add or deduct points from any member
- Change member tiers manually
- View full points activity log
- Export all members to CSV

### 🌿 Other Pages
- Live product filtering by category (no prices displayed — members WhatsApp to order)
- Strain finder quiz
- Step-by-step rolling tutorials with skill level filtering
- Events section with RSVP

---

## Database Schema

```sql
members
  id, created_at, first_name, last_name, email, phone,
  dob, tier, code, points, source, preferences,
  comms_opt_in, is_active

points_log
  id, created_at, member_id (→ members), action, points, note
```

---

## Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for the AI chatbot |

---

## 🚀 Commit History

| # | Commit | What Changed | Status |
|---|--------|-------------|--------|
| 1 | `Add files via upload` | Initial site upload — all HTML pages | ✅ |
| 2 | `Add Supabase Backend` | Supabase DB integration, register/login/members | ✅ |
| 3 | `Fix` | Dashboard blank page fix — URL param auth | ✅ |
| 4 | `Add AI Chatbot` | MadaKop AI chatbot injected into index.html | ✅ |
| 5 | `Create chat.js` | Vercel serverless function proxy for Claude API | ✅ |
| 6 | `Add files via upload` | Updated index.html — ESM version (caused issues) | ❌ |
| 7 | `Add files via upload` | Re-upload attempt | ❌ |
| 8 | `Add Vercel configuration for chat.js` | vercel.json — wrong runtime format | ❌ |
| 9 | `Add files via upload` | Re-upload attempt | ❌ |
| 10 | `Add files via upload` | Active deployment — vercel.json removed | ✅ |
| 11 | `Remove prices — Members Only` | All product prices hidden, WhatsApp to Order | ✅ |
| 12 | `Fix strain-finder prices` | Strain finder prices removed, Members Only | ✅ |

---

## Contact

📞 073 629 2224 · 065 252 2668
📸 [@madakop_](https://instagram.com/madakop_)
📍 Small Farm, Evaton, Sebokeng

---

*© 2025 MadaKop Healing Hub & Private Club · 18+ Only · Points have no cash value*
