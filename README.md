# Simple Volleyball Service Scouting App

A volleyball service scouting Progressive Web App (PWA) designed for **Android tablets in landscape orientation**.

## Key Features

- **Landscape Court View:** Standard FIVB dimensions ($18\text{m} \times 9\text{m}$) with left-to-right serving direction and opponent court zones (1 to 6).
- **Interactive Trajectory Drawing:** Tap behind the baseline to set serve start point, tap/drag to opponent court or out-of-bounds to set landing point.
- **Color Coding:**
  - 🟢 **Ace:** Green trajectory
  - 🔵 **In & Rally:** Blue trajectory
  - 🔴 **Fault:** Red trajectory
- **Serve Types:** Jump Float, Float, Jump Topspin, Topspin.
- **Live Predictive Analytics:**
  - Real-time Bayesian probabilities: $P(\text{Ace})$, $P(\text{In})$, $P(\text{Fault})$.
  - Visual predicted trajectory vector (purple dashed line) and target landing zone heat ring.
- **Match Management & Data Export:**
  - Pre-game setup: Team name, opponent, and player jersey numbers.
  - One-tap CSV download with full trajectory coordinates, zones, timestamps, and outcomes.
  - CSV import to load past matches.
  - Auto-saved to `localStorage` (works 100% offline).

## Deployment & Cloud Testing (Android Tablet)

1. Push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/simple_volleyball_service_scouting.git
   git push -u origin main
   ```
2. Enable GitHub Pages in repo **Settings > Pages > Source: GitHub Actions**.
3. Open `https://<your-username>.github.io/simple_volleyball_service_scouting/` in Chrome on your Android tablet (in landscape mode).
4. Tap **"Add to Home Screen"** to run full-screen without address bars or cables.
