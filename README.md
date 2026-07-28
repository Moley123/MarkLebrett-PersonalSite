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

- **15 gematria methods** computed simultaneously — Hechrachi, Gadol, Siduri,
  Katan, Katan Mispari, Kolel, Milui, Ne'elam, Perati, HaKlali, Meshulash,
  Bone'eh, AtBash, AlBam and Achbi
- **Compare mode** — put two to four words side by side and see which methods
  make them equal
- **Full Chumash search** — every word and phrase of up to three words, indexed
  by value, with the match highlighted inside its verse
- **Hebrew dates** — civil ↔ Hebrew conversion (with after-sunset handling) plus
  the gematria of the written date
- **Acronyms** — roshei and sofei teivot of a phrase, valued as words in their own right
- **Explore** — anagrams (which rearrangements are real Chumash words), six
  temurah cipher tables, and notarikon expansion from Torah vocabulary
- **Share as image** — a rendered card copied straight to the clipboard
- **Bridge calculator** — finds the words that close the gap between two values
- **Trend Tracker** — how often a word appears as the Torah progresses
- **Word Race** — the twenty most frequent words, racing chapter by chapter
- Hebrew numeral input and output (613 ⇄ תרי״ג)
- Parsha filtering, Colel mode (±1), single-word matching
- Shareable URLs — every view is encoded in the query string
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

## 📊 Gematria Data

The dataset lives in `public/gematria-data/` and **is committed to the repo**, so
neither `npm start` nor a deploy needs to regenerate it or reach Sefaria.

```
public/gematria-data/
├── manifest.json     ~0.5 KB   shard map + counts
├── verses.json       2.4 MB    each of the 5,846 verses exactly once
└── idx/<n>.json      ~43 KB    values [n*100 … n*100+99]
```

A search fetches the verse table once plus the single shard containing the
target value. The previous design shipped a single 58 MB `torah_index.json` that
repeated the full English verse on all 223,408 phrase entries; normalising it
and sharding by value cut the payload by 89% (and ~1.5 MB gzipped in practice).

To rebuild:

```bash
pip install requests
python3 backend_tools/build_gematria_data.py    # → public/gematria-data/
python3 backend_tools/build_race_data.py        # → src/data/race_data.json
python3 backend_tools/build_parshas.py          # → src/utils/parshas.js
python3 backend_tools/build_common_offline.py   # → src/data/common_gematria.json
```

All Sefaria text cleaning (markup, footnotes, paragraph markers, prefix lists)
goes through `backend_tools/sefaria_clean.py` so the builders can't drift apart.

### Tests

The gematria engine is pure and fully covered:

```bash
npm test
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
│   │   ├── EmelSolutions.js # Emel Solutions page
│   │   └── CertMonitor.js   # CT log monitor + detail panel
│   ├── gematria/            # Gematria Explorer (self-contained)
│   │   ├── engine/          # Pure calculation — methods, numerals, dates
│   │   ├── data/            # Sharded index loader + search hook
│   │   ├── components/      # Calculator, Compare, Bridge, Dates, Trends, Race
│   │   └── GematriaApp.css  # Scoped styles (gem- prefix)
│   ├── data/                # Static JSON (common_gematria.json, race_data.json)
│   └── utils/               # Shared helpers (parshas, ref filtering)
├── public/gematria-data/    # Generated, committed Gematria dataset
├── backend_tools/           # Python scripts for data generation
├── Dockerfile
├── nginx.conf
└── package.json
```

---

## 📄 License

MIT
