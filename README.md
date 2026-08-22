# VSRG Visualizer

A browser-based chart visualizer for vertical scrolling rhythm games. Load a chart and inspect it on an auto-playing note highway with timing, scroll, and playback controls.

This is a pattern-analysis tool. It intentionally has no audio playback, player input, or judgment system.

## Supported formats

Drop a single chart file into the application or choose it from the file picker.

| Format | Extensions |
| --- | --- |
| URC | `.urc` |
| osu!mania | `.osu` |
| Quaver | `.qua` |
| StepMania / Etterna | `.sm`, `.ssc` |
| BMS family | `.bms`, `.bme`, `.bml`, `.pms` |
| O2Jam | `.ojn` |

The parser is deliberately lenient: non-fatal issues are collected and shown as warnings. Files that contain multiple charts expose a difficulty selector. BMS `#RANDOM` and `#SWITCH` branches can be re-rolled from the warnings panel.

## Features

- PixiJS-rendered, down-scroll note highway with taps, holds, mines, fake notes, beat lines, and double-play layouts
- Original scroll and **No SV** modes; No SV removes scroll-velocity effects while preserving BPM changes
- Playback seek, pause, stop, and rates from `0.5x` to `2x`
- Adjustable scroll speed, light/dark/system DOM themes, and collapsible side panels
- Format-aware parsing through a shared timing compiler that handles BPM changes, stops, warps, meters, and scroll velocity

## Controls

| Shortcut | Action |
| --- | --- |
| `Space` | Play or pause |
| `Esc` | Stop and return to the start |
| `Left` / `Right` | Seek 5 seconds |
| `Shift` + `Left` / `Right` | Seek 1 second |
| `Up` / `Down` | Adjust scroll speed |
| `[` / `]` | Select previous / next difficulty |
| `S` | Toggle Original / No SV scroll mode |
| `T` | Toggle theme |
| `1` / `2` | Toggle left / right panel |
| `?` | Open shortcut help |

## Getting started

Prerequisites: a current Node.js release and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite, then drop a supported chart file into the page.

## Self-hosting

The application is a static site with no backend, so deployment is a single container
that serves the built files.

```bash
docker run -d -p 8080:8080 cloudholic/vsrg-visualizer:latest
```

For docker-compose, see `docker-compose.yaml` as a sample.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Type-check with `tsc -b` and create a production build |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm lint` | Run ESLint |
| `pnpm preview` | Preview the production build |

## Architecture

Each format parser produces a shared `SourceChart` representation while retaining its original millisecond or beat time axis. The compiler converts it into the renderer-facing `Chart` model by integrating BPM, stop, warp, meter, and scroll events. `flattenScroll` then derives the selected scroll mode without changing playback time.

The application uses React, TypeScript, Zustand, Tailwind CSS, DaisyUI, and PixiJS. The source is organized by responsibility:

- `src/parser/`: format detection and format-specific parsers
- `src/engine/`: chart compilation, scrolling, playback clock, and duration calculations
- `src/render/`: PixiJS highway geometry, palette, and note rendering
- `src/store/`: chart, playback, and persisted view settings
- `src/ui/`: application shell, panels, transport controls, and common UI components
