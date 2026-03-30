# AgriNova — Smart Fields, Better Yields

A full-stack agricultural platform that connects farmers directly to buyers, detects plant diseases using AI, and offers smart crop recommendations — all without middlemen.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Backend API Routes](#backend-api-routes)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Contact](#contact)

---

## Project Overview

AgriNova is a web platform with two user roles — **Farmers** and **Buyers**.

| Role    | Capabilities |
|---------|-------------|
| Farmer  | Register/Login, list crops for sale, manage their own product listings |
| Buyer   | Browse all available crops, search/filter by name or location, contact farmers via phone or WhatsApp |

**Smart Services:**
- **AI Crop Suggestion** — Get personalized crop recommendations based on soil health and climate.
- **AI Plant Disease Detection** — Upload a leaf image and get an instant diagnosis with treatment advice.
- **Polyhouse Services** — View and enquire about greenhouse construction, rental, and maintenance plans.

---

## Frontend Pages & Routes

The frontend is a static multi-page app served from `backend/public/`.

| File | URL Path | Description |
|---|---|---|
| `index.html` | `/` | Landing page — Hero section, Services overview, About section, Contact info |
| `auth.html` | `/auth.html` | Combined Login & Signup page for Farmers and Buyers |
| `marketplace.html` | `/marketplace.html` | Browse all crop listings; Farmer dashboard to add/delete own products |
| `disease.html` | `/disease.html` | AI Plant Disease Scanner — upload a photo, get diagnosis & treatment |
| `recommend.html` | `/recommend.html` | Smart AI Crop Suggestions — enter soil data for personalized advice |
| `polyhouse.html` | `/polyhouse.html` | Polyhouse service plans with WhatsApp CTAs |

---

## Backend API Routes

Base URL: `http://localhost:5000`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ Public | Register a new Farmer or Buyer |
| `POST` | `/api/auth/login` | ❌ Public | Login and receive a JWT token |

### Products

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/products` | ❌ Public | Any | Fetch all products with search support |
| `GET` | `/api/products/me` | ✅ JWT | Farmer | Fetch logged-in farmer's products |
| `POST` | `/api/products` | ✅ JWT | Farmer | Add a new crop listing (Multipart/Image) |
| `DELETE` | `/api/products/:id` | ✅ JWT | Farmer | Delete a specific product |

### AI Agricultural Services

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/predict-disease` | ❌ Public | AI leaf diagnosis and treatment advice |
| `POST` | `/api/recommend-crops` | ❌ Public | AI Soil-based crop suggestions |

---

## Tech Stack

### Backend
- **Express.js**: Web server
- **SQLite3**: Lightweight database
- **JWT**: Secure token-based auth
- **Multer**: File upload handling
- **AI Integration**: Generative AI for smart services

### Frontend
- **HTML5 / Vanilla CSS**: Modern glassmorphism UI
- **Vanilla JavaScript**: Dynamic interactions and API fetching
- **Google Fonts**: `Outfit` for premium typography

---

## Project Structure

```
website/
├── README.md
└── backend/
    ├── server.js          # Core Express server & API routes
    ├── database.sqlite    # Local database file
    ├── uploads/           # Storage for crop images
    └── public/            # Frontend Web App
        ├── index.html         # Main Landing
        ├── auth.html          # Auth Portal
        ├── marketplace.html   # Crop Market
        ├── disease.html       # AI Scanner
        ├── recommend.html     # AI Suggestion
        ├── polyhouse.html     # Infrastructure
        ├── style.css          # Global Design System
        ├── marketplace.css    # Dashboard styles
        ├── disease.css        # Scanner UI
        ├── polyhouse.css      # Services UI
        ├── recommend.css      # AI Suggestion UI
        ├── script.js          # Navigation & Animations
        ├── marketplace.js     # Market logic
        ├── disease.js         # AI Vision logic
        └── recommend.js       # AI Suggestion logic
```

---

## Getting Started

### Installation

```bash
# 1. Clone & Enter Backend
cd backend

# 2. Install Dependencies
npm install

# 3. Setup AI API Key
echo GEMINI_API_KEY=your_key_here > .env

# 4. Launch Project
npm start
```

The app will be live at **[http://localhost:5000](http://localhost:5000)**

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | (Optional) Used for real-time AI analysis. |

---

## Contact

**AgriNova Team**
- 📧 agrinova.in@gmail.com
- 📱 +91 6261475021
- 💬 [WhatsApp Us](https://wa.me/916261475021)

---

*© 2026 AgriNova. Modernizing agriculture for a better future.*


