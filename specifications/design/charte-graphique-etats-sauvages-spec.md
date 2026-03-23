# Graphic Charter Specification - Etats Sauvages

Version: `v1.0`  
Date: `2026-03-11`  
Source: `0-CHARTE_GRAPHIQUE_ETATS_SAUVAGES.pdf` (2025-09-16)

## 1) Objective
Define clear, implementation-ready UI rules to ensure the app consistently follows the **Etats Sauvages** visual identity on mobile (and web when relevant).

## 2) Core Brand Principles
The charter defines 4 key visual markers that must be preserved:
- `Typography offset`: side-step mindset, momentum, energy.
- `Black rectangle`: impact and differentiation.
- `Fern`: forest, wild, living nature.
- `Bump`: impulse, strength, signature motion cue.

Product implication: the interface must stay organic, natural, high-contrast, and strongly branded (avoid generic UI patterns).

## 3) Official Color Palette
Extracted from the charter palette page:

| Token | Hex | CMYK | Recommended UI usage |
|---|---|---|---|
| `brand.terracotta` | `#CD5833` | C00 M77 Y86 K00 | Strong accent, secondary CTA, brand alerts |
| `brand.moss` | `#89A33A` | C56 M16 Y100 K02 | Primary accent, success, active states |
| `brand.forest` | `#334E2B` | C88 M42 Y100 K46 | Main brand color (titles, strong text, deep surfaces) |
| `brand.sage` | `#B0C78E` | C42 M5 Y55 K0 | Soft backgrounds, secondary surfaces |
| `brand.mauve` | `#9494B0` | C48 M40 Y18 K00 | Secondary/info accent |
| `brand.ochre` | `#CC701F` | C5 M65 Y100 K00 | Signal/warm emphasis |
| `brand.salmon` | `#DA8D77` | C00 M55 Y50 K00 | Editorial accents/backgrounds |

Support colors (from logo rules):
- `brand.black`: `#000000`
- `brand.white`: `#FFFFFF`

## 4) Official Typography
According to the charter:
- `Mazzard H` (Light/Regular/Bold/Black): titles and primary text.
- `HeadTurn Smooth`: highlighted word(s) / very short emphasis text.
- `Futura` (Medium/Bold): secondary text.

UI usage rules:
- Screen title: `Mazzard H Bold/Black`.
- Body, labels, inputs: `Mazzard H Regular`.
- Secondary metadata/microcopy: `Futura Medium`.
- Short editorial badge (1-3 words): `HeadTurn Smooth` (limited use).

Fallbacks when custom fonts are unavailable:
- `Mazzard H` -> `Avenir Next` / `system-ui`
- `Futura` -> `Avenir Next` / `system-ui`
- `HeadTurn Smooth` -> `Mazzard H Bold`

## 5) Logo Rules (Mandatory)
### 5.1 Clear Space
- Keep a protective area of `1/6 of X` around the logo (charter rule).

### 5.2 Minimum Size
- Never go below `25 mm` in print.
- For digital UI, use a practical minimum equivalent: `>= 95 px` width.

### 5.3 Forbidden Uses (DON'T)
- Do not change logo opacity.
- Do not change logo colors.
- Do not distort logo proportions.
- Do not change logo typography.
- Do not shift the bump element inside the logo.

## 6) Visual Language Elements
### 6.1 Highlights
- Always in `UPPERCASE`.
- Respect the intended highlight shape proportions.
- Padding around highlighted word: `0.5x` (x = lowercase x height).

### 6.2 Icons and Arrows
- Can use charter colors.
- Purpose: rhythm, signaling, key information emphasis.

### 6.3 Fern
- Brand ornamental/background element.
- On photography: natural tones only.
- Prefer tone-on-tone and non-intrusive placement.

### 6.4 Bump
- Always placed at the bottom of a visual/container.
- Never centered.
- Minimum width: `40%` of the visual width (vertical, square, horizontal formats).

### 6.5 Diagrams
- `< 6` segments: monochromatic scale or multiple colors are acceptable.
- `> 6` segments: use distinct colors for readability.
- Use simplified round logo badge in center with shadow.

## 7) Product UI Translation (Mobile)
### 7.1 Centralized Tokens
Create/maintain a single token file (`mobile/src/app/brand-tokens.ts`) containing:
- Official colors.
- Typography styles and scale.
- Radius, shadow, spacing primitives.

### 7.2 Visual Hierarchy
- Main app background: light natural tones (`sage`/neutrals).
- Premium surfaces (hero/strong cards): `forest` with overlays.
- Primary CTA: `moss` or `forest` depending on contrast.
- Secondary CTA: `forest` outline or `terracotta/ochre` fill.

### 7.3 Key Components
- `Buttons`: rounded corners, strong typographic weight, avoid oversized labels.
- `Tabs/Segmented controls`: clean pill style, deep-tone active state.
- `Cards`: soft borders, light surfaces, text contrast >= AA.
- `Chips/Badges`: limited and intentional usage, avoid rainbow combinations.
- `Map overlays`: subtle brand cues only (fern/bump only if readability is preserved).

### 7.4 Authentication Screen
- Keep only essential decorative elements (no visual overload).
- Ensure clear branding: logo + "Etats Sauvages".
- Keep balanced proportion between CTAs and form fields.

## 8) Minimum Accessibility Requirements
- Standard text contrast: target `WCAG AA`.
- Do not encode status by color alone (add icon/text).
- Minimum touch target size: `44x44 pt`.

## 9) Design QA Checklist (UI Definition of Done)
- Only charter color tokens are used.
- Typography is compliant (or fallback is explicitly documented).
- Logo usage is compliant (clear space, size, no forbidden transforms).
- No decorative overload.
- Component styling remains consistent across screens.
- Contrast is validated on critical screens (auth, list, detail, map).

## 10) Governance
- Any non-charter color must be explicitly approved (PR + rationale).
- Any new component variant must reference existing design tokens.
- This spec is authoritative for UI decisions until a newer charter version is published.
