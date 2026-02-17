# 🧠 Machine Translation Systems Human Evaluation

This is a full-stack **Next.js** application designed to support **leaderboard** for **human evaluation of machine translation systems**. It allows uploading datasets (JSON), managing translation tasks, and evaluating (rating and ranking) models performance from multiple machine translation models.

---

## 🛠 Tech Stack

- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**
- **MongoDB** for database
- **LocalStorage** for persistence
- **Vercel** (for deployment)

---

## 📦 Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [MongoDB](https://www.mongodb.com/try/download/community) (local or Atlas) for data persistence
- Package manager: `npm`

---

## 🚀 Quick Start (Development)

```bash
# 1. Clone and enter the project
git clone https://github.com/lesan/horneval.git
cd horneval

# 2. Install dependencies
npm install

# 3. Set up environment (see Environment Variables below)
cp .env.example .env.local
# Edit .env.local with your values (MongoDB, API keys, etc.)

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔧 Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/lesan/horneval.git
cd horneval
```

### 2. Environment variables

Create a `.env` or `.env.local` file at the project root. Next.js loads both; `.env.local` overrides `.env` and is typically used for local secrets (both are gitignored).

**Option A — Copy from example (recommended):**

```bash
cp .env.example .env.local
```

Then edit `.env.local` and replace placeholders with your real values.

**Option B — Manual:** Ensure these variables are set (see [Environment Variables](#-environment-variables) below for full list and descriptions).

**Development tips:**

- Use a **local MongoDB** (e.g. `MONGODB_URI=mongodb://localhost:27017/`) or a dedicated dev cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Set `ROOT_URI=http://localhost:3000` and `NEXT_PUBLIC_BASE_URL` to your production or staging URL if you need correct links in emails.

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

Dev server runs at [http://localhost:3000](http://localhost:3000) with hot reload.

### 4. Lint

```bash
npm run lint
```

---

## 🧱 Production Setup

### Build and run locally (production mode)

```bash
npm run build
npm start
```

Runs the production server on port 3000.

### Deploy on Vercel

1. Push your code to GitHub/GitLab/Bitbucket.
2. [Import the repo](https://vercel.com/new) on Vercel.
3. **Add environment variables** in the Vercel project: **Settings → Environment Variables**. Use the same names as in [Environment Variables](#-environment-variables); you can paste from `.env.example` and fill values.
4. Deploy. Vercel will run `npm run build` and host the app.

**Production checklist:**

- Set `NEXT_PUBLIC_BASE_URL` to your production URL (e.g. `https://horneval.vercel.app`).
- Use a production MongoDB database and a strong `MONGODB_URI`.
- Use real SMTP or SendGrid credentials for password reset and confirmation emails.
- Never commit `.env` or `.env.local`; use Vercel (or your host) env UI for production secrets.

---

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_NAME` | Yes | App name (server-side). |
| `NEXT_PUBLIC_APP_NAME` | Yes | App name (client-side). |
| `APP_VERSION` | No | Application version. |
| `APP_DESCRIPTION` | No | Short app description. |
| `MONGODB_DB` | Yes | MongoDB database name. |
| `MONGODB_URI` | Yes | MongoDB connection URI (e.g. `mongodb://localhost:27017/` or Atlas URI). |
| `LESAN_API_URL` | Yes | Lesan API base URL. |
| `LESAN_API_KEY` | Yes | API key for Lesan services. |
| `GEMINI_API_KEY` | Yes | API key for Gemini (if used). |
| `SMTP_HOST` | Yes* | SMTP host (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Yes* | SMTP port (e.g. `587`). |
| `SMTP_USER` | Yes* | SMTP login email. |
| `SMTP_PASS` | Yes* | SMTP password (e.g. Gmail app password). |
| `FROM_EMAIL` | Yes* | Sender email. |
| `FROM_NAME` | No | Sender display name. |
| `SMTP_SERVICE` | No | Nodemailer service (e.g. `gmail`). |
| `SMTP_SECURE` | No | `true` for port 465, `false` for 587. |
| `SENDGRID_API_KEY` | No | SendGrid API key (alternative to SMTP). |
| `SENDGRID_SENDER_EMAIL` | No | Verified sender email for SendGrid. |
| `FORGET_PASSWORD_TOKEN_EXPIRATION` | No | Reset token TTL in ms (default 30 min). |
| `CONFIRM_EMAIL_TOKEN_EXPIRATION` | No | Confirm-email token TTL in ms. |
| `NEXT_PUBLIC_BASE_URL` | Yes | Public app URL (emails, client). |
| `ROOT_URI` | Yes | Base URL for server (e.g. `http://localhost:3000` in dev). |
| `GCP_PROJECT_ID` | No | Google Cloud project (if using GCS). |
| `GCP_CLIENT_EMAIL` | No | GCP service account email. |
| `GCP_PRIVATE_KEY` | No | GCP service account private key. |
| `GCS_BUCKET` | No | Google Cloud Storage bucket name. |

\* Either SMTP or SendGrid must be configured for email (e.g. password reset).

Full example with comments: see **`.env.example`** in the repo.

---

## 📁 Project Structure

```
src/
  app/                    # Next.js App Router
    api/                  # API routes (auth, batches, etc.)
    page.tsx              # Home
    layout.tsx
    datasets/             # Datasets UI
    asr/                  # ASR evaluation UI
    leaderboard/          # Leaderboard UI
    users/                # User management
    profile/              # User profile
    reset-password/       # Password reset flow
  components/             # Reusable UI components
  helpers/                # Utilities (e.g. leaderboard calculator)
  scripts/                # Data prep scripts (Python, etc.)
  dataset/                # Sample/example datasets (optional)

public/                   # Static assets (logo, etc.)
```

**Client persistence (browser):**

- `batches` — translation task batches
- `batches_details` — batch metadata
- `user` — current user info

---

## 📄 File Upload Format

### 🈸 Machine Translation (MT) evaluation batch schema

- **Supported types**: `.json`
- JSON structure should include:

  ```json
  {
    // "batch_id": "", # Batch ID will be gnerated on uploading by the system
    "dataset_name": "", // Required
    "dataset_domain": "", // Required
    // "dataset_type": "", // mt|asr|tts, this will be handled by the system on uploading the batch
    "batch_name": "", // Required
    "source_language": {
      "iso_name": "", // Required
      "iso_639_1": "", // Required
      "iso_639_3": "" // Required
    },
    "target_language": {
      "iso_name": "", // Required
      "iso_639_1": "", // Required
      "iso_639_3": "" // Required
    },
    "tasks": [
      {
        "id": "", // Required
        "input": "", // Required
        "models": [
          {
            "output": "", // Required
            "model": "A", // Required
            "rate": 0, // Required
            "rank": 0 // Required
          },
          {
            "output": "",
            "model": "B",
            "rate": 0,
            "rank": 0
          }
          // ... more models here
        ]
      }
      // ... more tasks here
    ],

    // rating_guideline is the guidelines for rating 1-5. You should add five items, you can update the description based on your needs, or you can completly ignore this, its optional field
    "rating_guideline": [
      {
        "scale": 1,
        "value": "Critical",
        "description": "This is for a completely wrong output. The output does not make sense given the source.",
        "example": []
      },
      {
        "scale": 2,
        "value": "Major",
        "description": "There is a serious problem in the output. For example, there is addition of content not in source, some parts of the source are missing or misinterpreted. It would be hard to match output with source without major modifications.",
        "example": []
      },
      {
        "scale": 3,
        "value": "Minor",
        "description": "The translation has minor problems given the source but requires some minor changes, e.g, changing a word or two to make it fully describe the source.",
        "example": []
      },
      {
        "scale": 4,
        "value": "Neutral",
        "description": "The output describes the source; however, there may be some problems with style such as punctuation, word order."
      },
      {
        "scale": 5,
        "value": "Kudos",
        "description": "Great job! The output correctly describes the source. It’s both accurate and fluent.",
        "example": []
      }
    ],

    //domains is for list of domains that your data should be annotated. You can update is with your own nees. Not only domains but even types of errors so your data can be annotated with it, or you can completly ignore this, its optional field
    "domains": [
      {
        "name": "Health",
        "description": "Covers topics related to physical and mental well-being, healthcare systems, and lifestyle practices that promote health.",
        "subdomains": [
          "Medical Care",
          "Wellness",
          "Nutrition",
          "Mental Health",
          "Public Health"
        ]
      },
      {
        "name": "Culture",
        "description": "Explores the creative, intellectual, and social expressions that define communities and societies.",
        "subdomains": [
          "Arts",
          "History",
          "Literature",
          "Philosophy",
          "Traditions"
        ]
      },
      {
        "name": "Agriculture",
        "description": "Encompasses food production, farming practices, and innovations in cultivating plants and animals.",
        "subdomains": [
          "Farming",
          "Livestock",
          "Agri-technology",
          "Sustainability",
          "Food Systems"
        ]
      },
      {
        "name": "Sport",
        "description": "Relates to physical competition, athletic performance, and the broader sports industry.",
        "subdomains": [
          "Athletics",
          "Training",
          "Esports",
          "Sports Media",
          "Sports Business"
        ]
      },
      {
        "name": "News",
        "description": "Focuses on current events, reporting, and developments around the world.",
        "subdomains": [
          "Global News",
          "Local News",
          "Investigative Journalism",
          "Breaking Events",
          "Sports Coverage"
        ]
      },
      {
        "name": "Politics",
        "description": "Involves governance, public policy, political systems, and civic discourse.",
        "subdomains": [
          "Elections",
          "Public Policy",
          "International Affairs",
          "Governance",
          "Political Commentary"
        ]
      },
      {
        "name": "Tech",
        "description": "Centers on technological advancements, digital innovation, and the impact of emerging tools.",
        "subdomains": [
          "Artificial Intelligence",
          "Software",
          "Cybersecurity",
          "Hardware",
          "Tech Startups"
        ]
      },
      {
        "name": "Construction",
        "description": "Covers building design, infrastructure development, and industry practices in construction.",
        "subdomains": [
          "Architecture",
          "Engineering",
          "Urban Development",
          "Sustainable Building",
          "Construction Safety"
        ]
      },
      {
        "name": "Business",
        "description": "Focuses on commerce, finance, markets, and economic activity at various scales.",
        "subdomains": [
          "Finance",
          "Banking",
          "Investments",
          "Cryptocurrency",
          "Market Trends"
        ]
      },
      {
        "name": "Environment",
        "description": "Addresses ecological systems, sustainability, and the human impact on nature.",
        "subdomains": [
          "Climate",
          "Conservation",
          "Renewables",
          "Pollution",
          "Environmental Policy"
        ]
      },
      {
        "name": "Education",
        "description": "Covers learning methods, academic institutions, and the evolving landscape of education.",
        "subdomains": [
          "Primary & Secondary Education",
          "Higher Education",
          "Digital Learning",
          "Research",
          "Education Technology"
        ]
      },
      {
        "name": "Entertainment",
        "description": "Focuses on media, performance arts, and industries that produce popular content and experiences.",
        "subdomains": ["Film", "Music", "Gaming", "Television", "Pop Culture"]
      },
      {
        "name": "Religion",
        "description": "Explores belief systems, spiritual practices, and religious traditions across cultures.",
        "subdomains": [
          "Faith Systems",
          "Spirituality",
          "Theology",
          "Religious Studies",
          "Ethics"
        ]
      }
    ]
  }
  ```

  ### 🗣️ Automatic Speech Recognition (ASR) evaluation batch schema

- **Supported types**: `.json`
- JSON structure should include:

  ```json
  {
    "batch_id": "",
    "dataset_name": "HornASR",
    "dataset_domain": "Health",
    "batch_name": "HornASR-Health-01",
    "language": {
      "iso_name": "Tigrinya",
      "iso_639_1": "ti",
      "iso_639_3": "tig"
    },
    "tasks": [
      {
        "id": "1",
        "input": "/datasets/xxx-yyy-zzz-0001.mp3",

        "models": [
          {
            "output": "We believe every human should be able to consume the webs content in their native language. We want to make sure that everyone has equal access to information to help them understand the world.",
            "model": "A",
            "rate": 0,
            "rank": 0
          },
          {
            "output": "We believe every human should be able to consume the webs content in their native language. We want to make sure that everyone has equal access to information to help them understand the world.",
            "model": "B",
            "rate": 0,
            "rank": 0
          }
          // ... more models outputs here
        ],
        "reference": "",
        "domain": [] // list of domains ["health", "news"] of the content
      }
      // ... more tasks here
    ],
    "rating_guideline": [
      {
        "scale": 1,
        "value": "Critical",
        "description": "This is for a completely wrong output. The output does not make sense given the source.",
        "example": []
      },
      {
        "scale": 2,
        "value": "Major",
        "description": "There is a serious problem in the output. For example, there is addition of content not in source, some parts of the source are missing or misinterpreted. It would be hard to match output with source without major modifications.",
        "example": []
      },
      {
        "scale": 3,
        "value": "Minor",
        "description": "The translation has minor problems given the source but requires some minor changes, e.g, changing a word or two to make it fully describe the source.",
        "example": []
      },
      {
        "scale": 4,
        "value": "Neutral",
        "description": "The output describes the source; however, there may be some problems with style such as punctuation, word order."
      },
      {
        "scale": 5,
        "value": "Kudos",
        "description": "Great job! The output correctly describes the source. It’s both accurate and fluent.",
        "example": []
      }
    ],
    "domains": [
      {
        "name": "Health",
        "description": "Covers topics related to physical and mental well-being, healthcare systems, and lifestyle practices that promote health.",
        "subdomains": [
          "Medical Care",
          "Wellness",
          "Nutrition",
          "Mental Health",
          "Public Health"
        ]
      },
      {
        "name": "Culture",
        "description": "Explores the creative, intellectual, and social expressions that define communities and societies.",
        "subdomains": [
          "Arts",
          "History",
          "Literature",
          "Philosophy",
          "Traditions"
        ]
      },
      {
        "name": "Agriculture",
        "description": "Encompasses food production, farming practices, and innovations in cultivating plants and animals.",
        "subdomains": [
          "Farming",
          "Livestock",
          "Agri-technology",
          "Sustainability",
          "Food Systems"
        ]
      },
      {
        "name": "Sport",
        "description": "Relates to physical competition, athletic performance, and the broader sports industry.",
        "subdomains": [
          "Athletics",
          "Training",
          "Esports",
          "Sports Media",
          "Sports Business"
        ]
      },
      {
        "name": "News",
        "description": "Focuses on current events, reporting, and developments around the world.",
        "subdomains": [
          "Global News",
          "Local News",
          "Investigative Journalism",
          "Breaking Events",
          "Sports Coverage"
        ]
      },
      {
        "name": "Politics",
        "description": "Involves governance, public policy, political systems, and civic discourse.",
        "subdomains": [
          "Elections",
          "Public Policy",
          "International Affairs",
          "Governance",
          "Political Commentary"
        ]
      },
      {
        "name": "Tech",
        "description": "Centers on technological advancements, digital innovation, and the impact of emerging tools.",
        "subdomains": [
          "Artificial Intelligence",
          "Software",
          "Cybersecurity",
          "Hardware",
          "Tech Startups"
        ]
      },
      {
        "name": "Construction",
        "description": "Covers building design, infrastructure development, and industry practices in construction.",
        "subdomains": [
          "Architecture",
          "Engineering",
          "Urban Development",
          "Sustainable Building",
          "Construction Safety"
        ]
      },
      {
        "name": "Business",
        "description": "Focuses on commerce, finance, markets, and economic activity at various scales.",
        "subdomains": [
          "Finance",
          "Banking",
          "Investments",
          "Cryptocurrency",
          "Market Trends"
        ]
      },
      {
        "name": "Environment",
        "description": "Addresses ecological systems, sustainability, and the human impact on nature.",
        "subdomains": [
          "Climate",
          "Conservation",
          "Renewables",
          "Pollution",
          "Environmental Policy"
        ]
      },
      {
        "name": "Education",
        "description": "Covers learning methods, academic institutions, and the evolving landscape of education.",
        "subdomains": [
          "Primary & Secondary Education",
          "Higher Education",
          "Digital Learning",
          "Research",
          "Education Technology"
        ]
      },
      {
        "name": "Entertainment",
        "description": "Focuses on media, performance arts, and industries that produce popular content and experiences.",
        "subdomains": ["Film", "Music", "Gaming", "Television", "Pop Culture"]
      },
      {
        "name": "Religion",
        "description": "Explores belief systems, spiritual practices, and religious traditions across cultures.",
        "subdomains": [
          "Faith Systems",
          "Spirituality",
          "Theology",
          "Religious Studies",
          "Ethics"
        ]
      }
    ]
  }
  ```

---

## 🎓 Learn More

### Dev Tools

- [Next.js Documentation](https://nextjs.org/docs) — Learn about Next.js features and API
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) — Utility-first CSS framework
- [Vercel Deployment Docs](https://nextjs.org/docs/app/building-your-application/deploying)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### About Language Models

- [The Leaderboard Illusion](https://arxiv.org/pdf/2504.20879) — We show with real-world experiments and simulations that the ability to select the best-scoring variant from N models enables systematic gaming.
- [Comparing MT System Performance](https://blog.modernmt.com/comparing-mt-system-performance/)
- [The Illusion of Thinking](https://ml-site.cdn-apple.com/papers/the-illusion-of-thinking.pdf) — Understanding the Strengths and Limitations of Reasoning Models
  via the Lens of Problem Complexity

---
