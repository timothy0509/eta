# TimoETA

A static, client‐side web app displaying real‐time Estimated Time of Arrival (ETA) information for:

- **KMB** bus stops  
- **MTR** heavy‐rail stations  
- **MTR Light Rail** stops  

It supports English, Traditional Chinese, and Simplified Chinese, plus light/dark themes and responsive layouts for desktop and mobile.

## Features

- **Three Modes**  
  - KMB Bus ETAs (search by partial stop name, optional route filter)  
  - MTR Heavy‐Rail Next Trains (search by 3-letter code or station name)  
  - MTR Light Rail Next Trains (search by stop name)  

- **Multi-Language**  
  - English (EN)  
  - Traditional Chinese (TC)  
  - Simplified Chinese (SC)  

- **Dark/Light Theme**  
  - Toggle at the top; persists via `localStorage`  

- **Responsive UI**  
  - Desktop: tables  
  - Mobile: cards with flex layout  
  - Auto-refresh every 30s for live ETAs  

- **Custom Styling**  
  - Route/Line color coding  
  - Platform circles on mobile  
  - High‐contrast text on colored backgrounds  

- **Material Design Enhancements**  
  - Material Design 3 elevation system with shadows
  - Smooth animations and micro-interactions
  - Enhanced ripple effects on buttons
  - Staggered list item entrance animations
  - Theme toggle with system preference detection
  - Floating Action Button (FAB) support
  - Accessibility features (reduced motion, high contrast)

---

## Getting Started

### Clone & Serve

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
# Serve locally (any static server):
npx http-server .
# then open http://localhost:8080
```

Or simply open `index.html` in your browser.

### Production

Push to GitHub, enable Pages on `main` (or `gh-pages`) branch.

---

## Usage

1. **Select Mode**  
   Click the segmented control:  
   - **KMB**  
   - **MTR**  
   - **Light Rail**  

2. **Select Language**  
   EN / 繁體 / 简体  

3. **(Optional) Toggle Dark Mode**  

4. **Search**  
   - **KMB**: enter a partial bus stop name, filter by routes (e.g. `14, 62X`)  
   - **MTR**: enter a station code (`TKO`) or exact station name (`Tiu Keng Leng`)  
   - **Light Rail**: enter the stop name (`Butterfly`)  

5. **View Results**  
   - Desktop: grouped tables  
   - Mobile: cards  
   - Platform circles and ETA times on the right for MTR/Light Rail  

6. **Auto Refresh**  
   - Bus & MTR: every 30s  
   - Light Rail: every 30s  

---

## File Structure

```
/
├── index.html
├── README.md
├── styles/
│   ├── style.css       # main styles, theme variables, responsive layout
│   └── material.css    # Material Design enhancements, animations, elevations
└── src/
    ├── app.js          # orchestrator: UI controls, theming, segmented logic
    ├── ui-animations.js # UI animations, ripple effects, micro-interactions
    ├── kmb.js          # KMB bus ETA logic & rendering
    ├── mtr.js          # MTR heavy-rail next train logic & rendering
    └── lr.js           # MTR Light Rail logic & rendering
```

- **index.html**  
  Main page: header, segmented controls, search form, results container.

- **styles/style.css**  
  Theme variables, responsive layout, tables, cards, route tags, platform circles.

- **styles/material.css**  
  Material Design 3 enhancements:
  - Elevation system (5 levels with light/dark mode)
  - Card, button, and FAB components
  - Ripple effect animations
  - List item entrance animations
  - Page transitions
  - Accessibility features

- **src/app.js**  
  Handles:
  - Mode & language segmented controls  
  - Dark mode toggle  
  - Search form submission & `localStorage`  
  - Calling `buildKMB()`, `buildMTR()`, or `buildLR()`  

- **src/ui-animations.js**  
  Provides:
  - Enhanced ripple effect on interactive elements
  - FAB animations with scroll behavior
  - List item staggered entrance animations
  - Theme toggle with system preference detection
  - Hover elevation effects
  - Automatic animation of new content

- **src/kmb.js**  
  Fetches KMB stop list & ETAs, groups by stop, renders tables/cards, handles mobile vs desktop and auto-refresh.

- **src/mtr.js**  
  Fetches MTR next train schedules for all lines serving a station, renders one table per direction with colored line header, and mobile cards with destination & platform+ETA.

- **src/lr.js**  
  Fetches Light Rail schedules for a stop, renders mobile cards (route + dest + platform+ETA) and desktop tables.

---

## Customization

- **Add/Update Stations**  
  - MTR station codes & names in `src/mtr.js` → `STATIONS`  
  - Light Rail stops in `src/lr.js` → `STOPS`

- **Route/Line Colors**  
  - In `src/mtr.js`: `LINE_COLOR`  
  - In `src/lr.js`: `COLORS`

- **Language Strings**  
  Modify `LANGS` objects in each JS file.

---

## Dependencies

- Pure **vanilla JavaScript**  
- No build tools required  
- Uses Fetch API  

---

## License

MIT © Timothy