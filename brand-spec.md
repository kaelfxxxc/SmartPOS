# SmartPOS authenticated workspace brand spec

> Source: user-provided dashboard reference and existing SmartPOS assets.
> Scope: authenticated workspace only. The public landing page keeps its own presentation.

## Core assets

### Logo

- Primary logo: `src/images/icons/smart-pos-logo.png`
- Public runtime copy: `public/brand/smart-pos-logo.png`
- Favicon: `public/brand/smart-pos-favicon.png`
- Preserve aspect ratio and use the transparent logo directly.

### Product imagery

- Product images come from scanned product records and Open Food Facts.
- Use the package image when present and the existing package placeholder otherwise.

## Workspace colors

- Operations sidebar: `#090f22`
- Sidebar raised surface: `#111a31`
- Workspace canvas: `#f5f7fb`
- Card surface: `#ffffff`
- Primary green: `#14b889`
- Deep green: `#078264`
- Primary text: `#0b1223`
- Muted text: `#7a8799`
- Borders: `#dde3ec`
- Warning: `#f5a313`

## Typography

- Display and metrics: Manrope, weights 700–800
- Interface and body: DM Sans, weights 400–700

## Layout rules

- Desktop uses a 280px dark operations rail and an 86px status header.
- Tablet uses an 86px icon rail.
- Mobile uses a hamburger drawer and a floating checkout basket.
- Cards use quiet borders, restrained shadows, and 12–16px corner radii.
- All metrics and chart values must come from real application records.

## Signature details

- Mint active navigation with a three-pixel left marker.
- Compact uppercase operational labels.
- Green live-state pills and small status dots.
- Dense but readable data cards with strong numeric hierarchy.

## Avoid

- Invented AI predictions or sample business metrics.
- Decorative gradients unrelated to product state.
- Excessive floating cards or ornamental icons.
