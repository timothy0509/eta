# TimoETA - User Guide

A comprehensive guide to using TimoETA, your fast and reliable Hong Kong public transit companion for real-time arrival information.

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [KMB Bus ETAs](#kmb-bus-etas)
- [MTR Next Train](#mtr-next-train)
- [Light Rail Schedule](#light-rail-schedule)
- [General Features](#general-features)
  - [Auto-Refresh](#auto-refresh)
  - [Favorites](#favorites)
  - [Recent Searches](#recent-searches)
  - [Language Support](#language-support)
  - [Theme](#theme)
  - [Deep Linking](#deep-linking)
- [Tips & Tricks](#tips--tricks)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)

---

## Introduction

TimoETA is a clean, fast web application that provides real-time arrival information for Hong Kong's public transit system, including:

- **KMB Buses** - Real-time ETAs, stop search, route filtering, and fare information
- **MTR Trains** - Next train arrivals for all MTR lines
- **Light Rail** - Real-time schedules and platform-specific arrivals

### Key Features

✨ **Real-time ETAs** - Accurate arrival times updated frequently  
🔍 **Smart Search** - Fuzzy matching and stop grouping for easy navigation  
⭐ **Favorites** - Save your frequently used stops and stations  
🔄 **Auto-Refresh** - Automatic updates every 10-60 seconds  
🌐 **Multi-language** - English, Traditional Chinese, and Simplified Chinese  
📱 **Responsive Design** - Works perfectly on mobile and desktop  
🎨 **Dark/Light Theme** - Choose your preferred visual style  
🔗 **Shareable Links** - Share specific stop views via URL

---

## Getting Started

### Accessing the Application

Visit the live application at: **https://eta.hkjc.uk**

### Initial Setup

1. **Select Your Transport Mode** - Choose from Bus (KMB), MTR, or Light Rail using the tabs at the top
2. **Choose Your Language** - Click the language toggle (EN/繁/简) in the top-right corner
3. **Set Auto-Refresh** - Configure how often ETAs update (10s, 15s, 30s, 60s, or off)
4. **Start Searching** - Use the search box to find your stop or station

---

## KMB Bus ETAs

### Searching for a Bus Stop

1. Click the **"Search stop name..."** button
2. Type your stop name or stop code (e.g., "Mong Kok", "KT313")
3. Results appear with:
   - **Stop name** in your selected language
   - **Stop code** (e.g., KT313-KT316)
   - **Alternative language name** for reference

### Understanding Stop Grouping

TimoETA intelligently groups stops with the same name:

- **Sequential stops** (e.g., KT313-KT316) are grouped together
- Click a grouped stop to see ETAs for all stops in that location
- This helps when buses stop on opposite sides of the road

### Using "Contains" Search

For broader searches:

1. Type at least 3 characters
2. Select **"Contains: [your search]"** from the results
3. This searches all stops containing your text in their name

### Route Filtering

#### Simple Mode (Default)
- Enter route numbers separated by commas (e.g., "40, 68X, 260X")
- Leave blank to show all routes at the stop

#### Advanced Mode
1. Toggle the **"Advanced"** switch
2. Click **"Add"** to add route filters
3. Select specific route variants from the dropdown
4. Each variant shows:
   - Route number with color-coded badge
   - Destination and direction
5. Remove filters with the trash icon

### Understanding ETA Results

Each ETA shows:

- **Route Badge** - Color-coded by type:
  - 🔴 Airport routes (A-series)
  - 🔵 Overnight routes (N-series)
  - 🟢 Cross-harbour routes
  - 🟡 Regular routes
- **Destination** - Where the bus is heading
- **Arrival Time** - Minutes until arrival (e.g., "3 min", "12 min")
- **Scheduled Time** - The planned departure time
- **Fare** - Fare information when available
- **Stale Indicator** - Visual cue if data is outdated

### Saving Favorites

1. After searching a stop, click the **heart icon** to save it
2. Your favorites appear in the "Saved" panel on the right
3. Favorites are stored locally in your browser

---

## MTR Next Train

### Searching for a Station

1. Switch to the **MTR** tab
2. Click **"Search station..."**
3. Type the station name in English or Chinese
4. Select your station from the results

### Understanding Station Results

The display shows:

- **Station name** with line indicators
- **Color-coded line badges** - Each MTR line has its signature color
- **Arrivals for all lines** serving the station

### Reading MTR ETAs

Each arrival shows:

- **Line color badge** (e.g., red for Tsuen Wan Line)
- **Destination station**
- **Arrival time** in minutes
- **Platform number** (when available)

### MTR Line Colors

- 🔵 **Island Line** - Blue
- 🔴 **Tsuen Wan Line** - Red
- 🟢 **Kwun Tong Line** - Green
- 🟡 **Tseung Kwan O Line** - Purple
- 🟣 **East Rail Line** - Light Blue
- 🟤 **West Rail Line** - Magenta
- 🟠 **Tung Chung Line** - Orange
- ⚪ **Airport Express** - Dark Teal
- 🟤 **Disneyland Resort** - Pink

---

## Light Rail Schedule

### Searching for a Light Rail Station

1. Switch to the **Light Rail** tab
2. Click **"Search station..."**
3. Type the station name
4. Select from the results

### Understanding LRT Results

The display shows:

- **Station name**
- **Platform-specific arrivals**
- **Route number** and **destination**
- **Arrival time** in minutes

### LRT Route Information

Light Rail routes are numbered (e.g., 505, 610, 705)
- Routes serve specific areas in the Northwest New Territories
- Some routes are circular (loop routes)

---

## General Features

### Auto-Refresh

Keep your ETAs up-to-date automatically:

1. Click the **Auto** button in the top toolbar
2. Choose your refresh interval:
   - **10s** - Very frequent updates
   - **15s** - Balanced (default)
   - **30s** - Moderate updates
   - **60s** - Less frequent
   - **Off** - Manual refresh only

**Tip:** Lower intervals use more data and battery on mobile devices.

### Favorites

#### Saving Favorites

1. Search for a stop/station
2. Click the **heart icon** (♡) to save
3. The icon fills (❤️) when saved

#### Managing Favorites

Access your favorites in the **"Saved"** panel:

**Favorites Tab:**
- **Pin items** - Click the pin icon to keep important stops at the top
- **Move items** - Use up/down arrows to reorder
- **Group items** - Assign favorites to custom groups
- **Remove items** - Click the trash icon to delete

**Groups:**
1. Type a group name and click **"Add group"**
2. Assign favorites to groups using the **"Group"** dropdown
3. Rename or delete groups as needed

**Tip:** Use groups to organize by location (e.g., "Home", "Office", "Shopping")

### Recent Searches

The **"Recent"** tab shows your recent searches:

- Up to 12 recent searches are saved
- Click any recent item to quickly reload it
- Clear all recents with the **"Clear"** button

### Language Support

TimoETA supports three languages:

- **EN** - English
- **繁** - Traditional Chinese (繁體中文)
- **简** - Simplified Chinese (简体中文)

**To change language:**
1. Click the language toggle in the top-right corner
2. Select your preferred language
3. All UI elements update immediately

**Note:** KMB stop names and ETAs are available in all three languages. MTR and LRT primarily support English and Traditional Chinese.

### Theme

Switch between dark and light modes:

1. Click the **theme toggle** (sun/moon icon) in the top-right
2. Choose **Light**, **Dark**, or **System**

**System** automatically matches your device's theme setting.

### Deep Linking

Share specific views with others:

- The URL updates as you search and filter
- Copy and share the URL to let others see the exact same view
- Example: `https://eta.hkjc.uk/?mode=kmb&stop=...&routes=40,68X`

**Use cases:**
- Share your commute stops with friends
- Bookmark frequently used views
- Link to specific stops in messages or notes

---

## Tips & Tricks

### 🚀 Quick Tips

1. **Bookmark your favorites** - Save your regular stops for one-click access
2. **Use stop codes** - Faster than typing full names (e.g., "KT313" vs "Kwun Tong Ferry Pier")
3. **Group your favorites** - Organize by location or purpose
4. **Enable auto-refresh** - Set to 15s for the best balance of accuracy and performance
5. **Use advanced filtering** - Filter specific route variants to reduce clutter

### 🎯 Power User Features

1. **Pin important stops** - Keep your most-used stops at the top of favorites
2. **Share URLs** - Send direct links to specific stops
3. **Use "Contains" search** - Find all stops with a common word (e.g., "Mong Kok")
4. **Check stale indicators** - If data looks old, manually refresh

### 📱 Mobile Tips

1. **Add to home screen** - Install as a Progressive Web App (PWA) for quick access
2. **Use landscape mode** - Better view of ETA tables
3. **Reduce auto-refresh** - Save battery by using 30s or 60s intervals

### 🔍 Search Tips

1. **Fuzzy matching** - You don't need exact spelling
2. **Mixed languages** - Search in English or Chinese
3. **Stop codes** - Most accurate way to find a specific stop
4. **Partial names** - Type part of the name and results appear

---

## FAQ

### General Questions

**Q: Is TimoETA free to use?**  
A: Yes, TimoETA is completely free and open source.

**Q: How accurate are the ETAs?**  
A: ETAs are sourced directly from official KMB, MTR, and LRT APIs. Real-time accuracy depends on the transit operators' data.

**Q: Does the app work offline?**  
A: No, an internet connection is required to fetch real-time data.

**Q: Is my data stored or shared?**  
A: All favorites and settings are stored locally in your browser. No data is sent to external servers.

### KMB Questions

**Q: Why are some stops grouped together?**  
A: Stops with the same name and sequential codes (e.g., opposite sides of the road) are grouped for convenience.

**Q: What does the route badge color mean?**  
A: Colors indicate route type: Airport (red), Overnight (blue), Cross-harbour (green), Regular (yellow).

**Q: Can I see fare information?**  
A: Yes, fares are displayed when available from the transit data.

**Q: What is "Contains" search?**  
A: It searches all stop names containing your text, useful for finding multiple stops in an area.

### MTR Questions

**Q: Why do I see multiple lines for one station?**  
A: Interchange stations serve multiple MTR lines, and all arrivals are shown.

**Q: How often is MTR data updated?**  
A: MTR ETAs update according to your auto-refresh setting.

### Light Rail Questions

**Q: What areas does Light Rail serve?**  
A: Light Rail serves Tuen Mun, Yuen Long, and Tin Shui Wai in the Northwest New Territories.

**Q: Why do some routes have the same number?**  
A: Some routes are circular (loop routes) that return to the starting point.

### Favorites & Settings

**Q: How many favorites can I save?**  
A: There's no hard limit, but the UI is optimized for displaying 10-20 items comfortably.

**Q: Will my favorites be lost if I clear my browser data?**  
A: Yes, favorites are stored in browser local storage. Consider bookmarking important URLs.

**Q: Can I sync favorites across devices?**  
A: Not currently, but you can share URLs to recreate views on another device.

**Q: What happens when I change languages?**  
A: All UI text updates, and stop/station names change to the selected language where available.

---

## Troubleshooting

### Common Issues

#### "No results found" when searching

**Solutions:**
1. Check your spelling
2. Try searching in a different language
3. Use fewer characters (minimum 2-3)
4. Try the stop code instead of the name
5. Use "Contains" search for broader results

#### ETAs not updating

**Solutions:**
1. Check your internet connection
2. Verify auto-refresh is enabled (not "Off")
3. Try a manual page refresh
4. Check if you see a stale indicator (old data)
5. Clear browser cache and reload

#### Favorites disappeared

**Solutions:**
1. Check if you cleared browser data recently
2. Verify you're using the same browser/device
3. Check browser settings for local storage permissions
4. Re-add your important stops and bookmark the URLs

#### Slow performance

**Solutions:**
1. Reduce auto-refresh frequency (try 30s or 60s)
2. Close unnecessary browser tabs
3. Clear browser cache
4. Disable browser extensions temporarily
5. Try a different browser

#### Mobile display issues

**Solutions:**
1. Rotate to landscape mode for better table view
2. Ensure you're using the latest browser version
3. Check if your browser supports modern web features
4. Try adding to home screen as a PWA

#### Language not changing

**Solutions:**
1. Click the language toggle firmly
2. Refresh the page and try again
3. Clear browser cache
4. Check browser console for errors (advanced)

### Data Issues

#### Stale data indicator appears

This means the ETA data is old. Solutions:
1. Manual refresh the page
2. Check your internet connection
3. Wait a few minutes for the system to recover
4. The indicator should disappear when fresh data arrives

#### Incorrect ETA times

**Note:** ETAs are sourced from official APIs. If they seem incorrect:
1. Check the scheduled time vs. real-time ETA
2. Real-time ETAs can change due to traffic conditions
3. Report persistent issues to the transit operator

#### Missing routes

**Solutions:**
1. Some routes may not be available at certain times
2. Check if it's an overnight route (N-series) running only at night
3. Verify the route exists using the transit operator's official app
4. Special routes may not be included in the data

### Browser Compatibility

**Supported browsers:**
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Android Chrome)

**Known issues:**
- Internet Explorer is not supported
- Some older browsers may have display issues
- Privacy-focused browsers may block local storage

### Getting Help

If you encounter issues not covered here:

1. **Check the GitHub repository:** https://github.com/timothy0509/eta
2. **Report bugs:** Create an issue on GitHub
3. **Try another browser:** Rule out browser-specific issues
4. **Clear all data:** Reset by clearing browser cache and local storage

---

## Additional Resources

- **Live Application:** https://eta.hkjc.uk
- **Source Code:** https://github.com/timothy0509/eta
- **Data Source:** [hk-bus-eta](https://github.com/hkbus/hk-bus-eta) npm package

---

## Version History

- **Current Version:** 0.1.0
- **Last Updated:** 2026

---

## License

TimoETA is open source software licensed under the MIT License.

---

*Thank you for using TimoETA! We hope this guide helps you make the most of your Hong Kong transit experience.*
