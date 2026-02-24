# Mark Lebrett — Personal Site

A full-stack personal portfolio and toolset built with **React**. Deployed via **Docker + Nginx** on DigitalOcean, with CI/CD through GitHub Actions.

---

## 🌐 Live Site

> **[marklebrett.com](https://marklebrett.com)**

---

## 📦 What's Inside

### 🏠 Landing Page
Personal portfolio homepage — links to all projects and tools.

### 🔢 Gematria Explorer
An interactive Hebrew Gematria calculator and Torah research tool.

- Real-time Gematria calculation as you type
- Full Torah (Pentateuch) search — find words, phrases, and verses matching a value
- Parsha filtering, Colel mode (±1), whole-verse and single-word matching
- Wedding / Matchmaker calculator — finds the numerical bridge between two names
- "Did you know?" cards for culturally significant numbers (18 = Chai, 26 = Hashem…)
- Built-in virtual Hebrew keyboard

### 🏢 Emel Solutions
Marketing and product page for Emel Solutions — a startup in the AI automation space.

### 🔐 CertStream Monitor
A live SSL/TLS certificate transparency log monitor with phishing and brand-abuse detection.

- Polls Google's Certificate Transparency log REST APIs directly (no third-party dependency)
- Parses DER-encoded certificates in the browser to extract domains, issuer, and SAN fields
- Keyword-based risk classification (clean / suspicious / high-risk)
- Side detail panel on click: all covered domains, CA, log source, cert index, issued date
- Investigate links: crt.sh, VirusTotal, Shodan

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router, CSS3 |
| Data (Gematria) | Python — fetches from the [Sefaria API](https://www.sefaria.org/developers) |
| Deployment | Docker, Nginx |
| CI/CD | GitHub Actions → DigitalOcean (SSH deploy) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm

### Install & Run

```bash
git clone https://github.com/Moley123/MarkLebrett-PersonalSite.git
cd MarkLebrett-PersonalSite
npm install
npm start
```

Open: `http://localhost:3000`

---

## 📊 Gematria Data Setup

The Gematria tool relies on a pre-built Torah index. Generate it before running:

```bash
cd backend_tools
pip install requests
python build_index.py          # → public/torah_index.json  (~50 MB)
python build_parshas.py        # → src/utils/parshas.js
python build_common_offline.py # → src/data/common_gematria.json
cd ..
```

---

## 🐳 Production Deployment (Docker + Nginx)

```bash
docker compose up -d --build
```

The app is served on port 80 via Nginx. GitHub Actions automatically deploys on every push to `main`.

---

## 📁 Project Structure

```
/
├── src/
│   ├── components/          # React page components
│   │   ├── LandingPage.js   # Portfolio homepage
│   │   ├── GematriaApp.js   # Gematria calculator
│   │   ├── EmelSolutions.js # Emel Solutions page
│   │   └── CertMonitor.js   # CT log monitor + detail panel
│   ├── data/                # Static JSON (common_gematria.json)
│   └── utils/               # Logic helpers (calculator, parshas, keyboard)
├── public/                  # Static assets + torah_index.json
├── backend_tools/           # Python scripts for data generation
├── Dockerfile
├── nginx.conf
└── package.json
```

---

## 📄 License

MIT
