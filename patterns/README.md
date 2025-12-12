# Grayscale Pattern Images

This directory contains 16 grayscale pattern images (512x512 PNG) used for the clinical genogram visualization.

## Pattern Files

Each pattern file should be a **512x512 pixel grayscale PNG** image. The patterns are used both for:
1. **SVG pattern fills** in the genogram shapes (scaled seamlessly)
2. **Legend thumbnails** (downscaled for display)

### Pattern List

| File | Pattern ID | Description | Pattern Type |
|------|-----------|-------------|--------------|
| `pattern-01.png` | pattern-01 | Top-Left Fill | Quadrant fill with top-left corner filled |
| `pattern-02.png` | pattern-02 | Top-Right Fill | Quadrant fill with top-right corner filled |
| `pattern-03.png` | pattern-03 | Bottom-Left Fill | Quadrant fill with bottom-left corner filled |
| `pattern-04.png` | pattern-04 | Bottom-Right Fill | Quadrant fill with bottom-right corner filled |
| `pattern-05.png` | pattern-05 | Dots | Regular dot pattern |
| `pattern-06.png` | pattern-06 | Horizontal Lines | Horizontal stripe pattern |
| `pattern-07.png` | pattern-07 | Vertical Lines | Vertical stripe pattern |
| `pattern-08.png` | pattern-08 | Diagonal Right | Diagonal lines from bottom-left to top-right |
| `pattern-09.png` | pattern-09 | Diagonal Left | Diagonal lines from top-left to bottom-right |
| `pattern-10.png` | pattern-10 | Checkerboard | Classic checkerboard pattern |
| `pattern-11.png` | pattern-11 | Cross-Hatch | Intersecting diagonal lines |
| `pattern-12.png` | pattern-12 | Small Dots | Fine dot pattern |
| `pattern-13.png` | pattern-13 | Grid | Grid/mesh pattern |
| `pattern-14.png` | pattern-14 | Waves | Wave/undulating pattern |
| `pattern-15.png` | pattern-15 | Brick | Brick/offset pattern |
| `pattern-16.png` | pattern-16 | Zigzag | Zigzag/chevron pattern |

## Image Requirements

- **Resolution**: 512x512 pixels
- **Format**: PNG
- **Color Mode**: Grayscale or RGB (will be used as grayscale)
- **Background**: White (#FFFFFF)
- **Foreground**: Medium gray (#666666 recommended)
- **Tiling**: Patterns should tile seamlessly for repeating use

## Usage

The patterns are automatically loaded by the `PatternManager` class in [`js/patterns.js`](../js/patterns.js:1) and used in:
- SVG pattern definitions for shape fills
- Legend thumbnails (downscaled versions)

## Creating New Patterns

To add a new pattern:
1. Create a 512x512 grayscale PNG image
2. Name it `pattern-XX.png` (where XX is the next number)
3. Add the pattern definition to [`js/patterns.js`](../js/patterns.js:6) in the `availablePatterns` array
4. Update this README with the new pattern information

## Notes

- Patterns are assigned randomly to conditions when they are first encountered
- The same pattern will be used consistently for the same condition throughout the genogram
- Higher contrast patterns (darker grays) may be more visible at smaller sizes