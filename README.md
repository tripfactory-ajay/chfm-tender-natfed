# CHFM Tender Pricing Tool

AI-powered NatFed 8 Schedule of Rates matching and pricing engine for CHFM Group.

## What it does

- Accepts a pasted Bill of Quantities from any tender document
- Uses Claude AI to match each line item to the correct **NatFed 8 SOR code**
- Applies your chosen **percentage adjustment** (e.g. −5% as a starting position)
- Shows **confidence scores** per match and flags low-confidence items for review
- Lets you **manually override** any rate before submission
- Exports to **CSV** (Excel-ready), **tab-separated text**, or **JSON**

## How to use

### Option A — Open directly in a browser (no server needed)

1. Download or clone this repository
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari)
3. That's it — no build step, no dependencies

### Option B — Host on GitHub Pages

1. Fork or push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, root folder
4. Your tool will be live at `https://yourusername.github.io/chfm-tender-tool/`

## Usage walkthrough

### Step 1 — Upload tender
Paste your Bill of Quantities line items into the text area. Each line needs:
```
Ref   Description   Unit   Quantity
```
Separated by tabs or two or more spaces. Click **Load sample tender** to see the format.

### Step 2 — Pricing config
- Set your **adjustment %** (default −5%)
- Select **region** and **contract type**
- Enter your **Anthropic API key** (get one free at [console.anthropic.com](https://console.anthropic.com))

> Your API key is used only in your browser session. It is never stored, logged, or sent anywhere other than directly to the Anthropic API.

### Step 3 — AI matching
Claude reads each line item description and:
- Matches it to the closest NatFed 8 SOR code
- Confirms the correct unit of measure (m, m2, m3, Nr, Sum, Days etc.)
- Assigns a realistic 2024 base rate
- Applies your adjustment percentage
- Returns a confidence score (0–100%)

### Step 4 — Review & export
- Edit any rate manually (marked as "override")
- Adjust the global percentage live with the slider
- Export to CSV, copy as text, or download JSON

## NatFed 8 SOR sections covered

| Section | Description |
|---------|-------------|
| A | Preliminaries / temporary works |
| C | Concrete works |
| D | Drainage / groundworks |
| E | Excavation / filling / hardcore |
| J | Joinery / floors |
| P | Plumbing / pipework / valves |
| Z | Waterproofing / membranes |

## Requirements

- A modern web browser (no installation needed)
- An [Anthropic API key](https://console.anthropic.com) (pay-as-you-go, ~£0.01–0.05 per tender)

## File structure

```
chfm-tender-tool/
├── index.html      # Main application shell
├── style.css       # All styles
├── app.js          # Application logic & API integration
└── README.md       # This file
```

## Customisation

### Adding a NatFed 8 rates database
If you have the NatFed 8 SOR Excel file, you can upload it and we can embed the actual rate lookup table into the tool, replacing the AI-estimated rates with exact published rates.

### Adjusting the AI prompt
The prompt sent to Claude is in `app.js` in the `buildPrompt()` function. You can add specific SOR sections, adjust the instruction style, or add company-specific pricing rules there.

### Changing the default adjustment
In `index.html`, find `value="-5"` on the slider inputs and change to your preferred default.

## Accreditations

CHFM Group holds: ISO 9001 | ISO 14001 | ISO 45001 | SafeContractor | CHAS | NICEIC | Gas Safe | BM Trada

---

CHFM Group, Lanark Court, Tannochside Business Park, Ellismuir Way, Uddingston, G71 5PW  
[NDevlin@CHFMGroup.com](mailto:NDevlin@CHFMGroup.com) | 0141 611 2444
