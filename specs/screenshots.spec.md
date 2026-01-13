# Screenshots Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0

---

## 1. Overview

The screenshot system provides automated capture of weblet previews for marketplace listings, documentation, and discovery. It launches weblets in a headless browser, captures static screenshots at multiple viewport sizes, and optionally records animated GIFs to demonstrate interactivity.

---

## 2. Requirements

### 2.1 Functional Requirements

#### CLI Command

- **FR-SS-001**: The CLI SHALL provide a `weblet screenshot <path>` command that captures screenshots of a weblet
- **FR-SS-002**: The CLI SHALL support a `--sizes` option to specify viewport sizes (default: `desktop,mobile`)
- **FR-SS-003**: The CLI SHALL support a `--output` option to specify output directory (default: `assets/screenshots/`)
- **FR-SS-004**: The CLI SHALL support a `--animated` flag to capture animated GIF preview
- **FR-SS-005**: The CLI SHALL support a `--duration` option for animated GIF length in seconds (default: 5)
- **FR-SS-006**: The CLI SHALL support a `--update-manifest` flag to add screenshot paths to APP.md
- **FR-SS-007**: The CLI SHALL lazy-load Playwright dependency on first use
- **FR-SS-008**: The CLI SHALL auto-install Playwright browsers if not present

#### Viewport Presets

- **FR-VP-001**: The CLI SHALL support preset `desktop` (1280x800)
- **FR-VP-002**: The CLI SHALL support preset `mobile` (375x667)
- **FR-VP-003**: The CLI SHALL support preset `tablet` (768x1024)
- **FR-VP-004**: The CLI SHALL support preset `wide` (1920x1080)
- **FR-VP-005**: The CLI SHALL support custom dimensions via `WIDTHxHEIGHT` format (e.g., `800x600`)

#### Screenshot Capture

- **FR-CAP-001**: The CLI SHALL start the weblet server before capturing
- **FR-CAP-002**: The CLI SHALL wait for page load complete (`networkidle` state)
- **FR-CAP-003**: The CLI SHALL support a `--wait` option for additional delay in ms (default: 1000)
- **FR-CAP-004**: The CLI SHALL support a `--route` option to capture specific routes (default: `/`)
- **FR-CAP-005**: The CLI SHALL capture PNG format for static screenshots
- **FR-CAP-006**: The CLI SHALL capture full page by default, with `--viewport-only` option available
- **FR-CAP-007**: The CLI SHALL stop the weblet server after capture completes

#### Animated GIF Capture

- **FR-GIF-001**: The CLI SHALL record video using Playwright's video recording
- **FR-GIF-002**: The CLI SHALL convert video to GIF using ffmpeg (if available) or fallback method
- **FR-GIF-003**: The CLI SHALL support `--fps` option for GIF frame rate (default: 10)
- **FR-GIF-004**: The CLI SHALL support `--interactions` option to specify a script of user interactions
- **FR-GIF-005**: The CLI SHALL optimize GIF file size to under 5MB when possible
- **FR-GIF-006**: The CLI SHALL generate a static thumbnail from the first frame

#### Interaction Scripts

- **FR-INT-001**: The CLI SHALL support JSON interaction scripts for animated captures
- **FR-INT-002**: Interaction scripts SHALL support `click` action with CSS selector
- **FR-INT-003**: Interaction scripts SHALL support `type` action with selector and text
- **FR-INT-004**: Interaction scripts SHALL support `wait` action with duration in ms
- **FR-INT-005**: Interaction scripts SHALL support `scroll` action with x/y delta
- **FR-INT-006**: Interaction scripts SHALL support `hover` action with CSS selector

#### Manifest Integration

- **FR-MAN-001**: The CLI SHALL update APP.md `screenshots` field when `--update-manifest` is used
- **FR-MAN-002**: The manifest SHALL support array of screenshot paths
- **FR-MAN-003**: The manifest SHALL support object format with metadata per screenshot

### 2.2 Non-Functional Requirements

- **NFR-SS-001**: Screenshot capture SHALL complete within 30 seconds for static images
- **NFR-SS-002**: Animated GIF capture SHALL complete within duration + 30 seconds
- **NFR-SS-003**: The system SHALL work without ffmpeg (degraded GIF quality acceptable)
- **NFR-SS-004**: Playwright dependency SHALL only be installed when screenshot command is first used
- **NFR-SS-005**: The system SHALL provide progress feedback during capture
- **NFR-SS-006**: The system SHALL clean up temporary files after capture

---

## 3. Interface

### 3.1 Command Signature

```
weblet screenshot <path> [options]
  --sizes <list>         Viewport sizes, comma-separated (default: desktop,mobile)
  --output <dir>         Output directory (default: assets/screenshots/)
  --animated             Capture animated GIF preview
  --duration <seconds>   Animation duration (default: 5)
  --fps <number>         GIF frame rate (default: 10)
  --wait <ms>            Additional wait after page load (default: 1000)
  --route <path>         Route to capture (default: /)
  --interactions <file>  JSON file with interaction script
  --viewport-only        Capture viewport only, not full page
  --update-manifest      Add paths to APP.md screenshots field
  --overwrite            Overwrite existing screenshots
  --json                 Output results as JSON
```

### 3.2 Preset Dimensions

```typescript
const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  wide: { width: 1920, height: 1080 },
};
```

### 3.3 Interaction Script Format

```typescript
interface InteractionScript {
  actions: InteractionAction[];
}

type InteractionAction =
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string }
  | { type: "wait"; duration: number }
  | { type: "scroll"; x?: number; y?: number }
  | { type: "hover"; selector: string }
  | { type: "press"; key: string };
```

Example interaction script (`interactions.json`):
```json
{
  "actions": [
    { "type": "wait", "duration": 500 },
    { "type": "click", "selector": "#new-game-btn" },
    { "type": "wait", "duration": 1000 },
    { "type": "click", "selector": ".card:first-child" },
    { "type": "wait", "duration": 500 },
    { "type": "click", "selector": "#column-3" }
  ]
}
```

### 3.4 APP.md Screenshot Fields

Simple format:
```yaml
screenshots:
  - assets/screenshots/desktop.png
  - assets/screenshots/mobile.png
  - assets/screenshots/preview.gif
```

Detailed format:
```yaml
screenshots:
  - path: assets/screenshots/desktop.png
    size: desktop
    description: Main dashboard view
  - path: assets/screenshots/mobile.png
    size: mobile
    description: Mobile responsive layout
  - path: assets/screenshots/preview.gif
    animated: true
    duration: 5
    description: Interactive demo showing card gameplay
```

### 3.5 Output Structure

```
my-weblet/
└── assets/
    └── screenshots/
        ├── desktop.png          # 1280x800 static
        ├── mobile.png           # 375x667 static
        ├── tablet.png           # 768x1024 static
        ├── preview.gif          # Animated preview
        └── preview-thumb.png    # First frame of GIF
```

---

## 4. Behavior

### 4.1 Capture Flow

1. **Validation**: Verify weblet has valid APP.md
2. **Dependency Check**: Ensure Playwright is installed (prompt to install if not)
3. **Server Start**: Launch weblet using appropriate runtime
4. **Wait for Ready**: Poll until server responds (max 10 seconds)
5. **Browser Launch**: Start headless Chromium via Playwright
6. **Navigate**: Go to specified route, wait for `networkidle`
7. **Additional Wait**: Apply `--wait` delay for animations/renders
8. **Capture Loop**: For each viewport size:
   - Resize viewport
   - Wait for layout stabilization (100ms)
   - Capture screenshot
9. **Animated Capture** (if `--animated`):
   - Start video recording
   - Execute interaction script (if provided) or wait for duration
   - Stop recording
   - Convert to GIF
   - Extract thumbnail
10. **Cleanup**: Close browser, stop server
11. **Manifest Update** (if `--update-manifest`): Add paths to APP.md

### 4.2 Server Detection

For runtime detection:
```typescript
function getStartCommand(manifest: ParsedManifest): string[] {
  switch (manifest.runtime) {
    case "browser":
      // Use simple static server
      return ["bun", "--serve", "."];
    case "bun":
      return ["bun", manifest.server || "serve.ts"];
    case "deno":
      return ["deno", "run", "--allow-net", "--allow-read", manifest.server || "serve.ts"];
    case "node":
      return ["node", manifest.server || "serve.js"];
  }
}
```

### 4.3 GIF Conversion

Primary method (with ffmpeg):
```bash
ffmpeg -i recording.webm -vf "fps=10,scale=640:-1:flags=lanczos" -c:v gif output.gif
```

Fallback method (without ffmpeg):
- Extract frames using Playwright screenshots at intervals
- Combine using a pure-JS GIF encoder (e.g., `gif-encoder-2`)
- Accept lower quality/larger file size

### 4.4 Lazy Dependency Loading

```typescript
async function ensurePlaywright(): Promise<void> {
  try {
    await import("playwright");
  } catch {
    console.log("Installing Playwright (first-time setup)...");
    await $`bun add playwright`;
    await $`bunx playwright install chromium`;
    console.log("Playwright installed successfully.");
  }
}
```

---

## 5. Error Handling

| Error Condition | Behavior |
|-----------------|----------|
| APP.md not found | Exit with error: "No APP.md found at {path}" |
| Server fails to start | Exit with error after 10s timeout |
| Page load timeout | Exit with error: "Page failed to load within 30s" |
| Playwright not installed | Prompt user to install, offer automatic install |
| ffmpeg not available | Fall back to JS-based GIF encoding, warn user |
| Invalid viewport size | Exit with error listing valid presets and format |
| Interaction script error | Log warning, continue capture without interactions |
| Output directory not writable | Exit with error suggesting alternative path |
| Screenshot already exists | Skip unless `--overwrite` flag provided |

---

## 6. Dependencies

- **Weblet Spec Reference**: Section 4 (APP.md Manifest), Section 14 (Examples)
- **CLI Spec Reference**: FR-CLI-001 (run command), FR-PARSE-001 (parsing)
- **Runtime Spec Reference**: Server startup behavior
- **External Dependencies**:
  - `playwright` - Browser automation (lazy-loaded)
  - `ffmpeg` - Video to GIF conversion (optional, system install)
  - `gif-encoder-2` - Fallback GIF encoding (bundled)

---

## 7. Acceptance Criteria

- [ ] `weblet screenshot ./my-app` captures desktop and mobile PNGs
- [ ] `weblet screenshot ./my-app --sizes desktop,tablet,wide` captures three sizes
- [ ] `weblet screenshot ./my-app --sizes 800x600` captures custom size
- [ ] `weblet screenshot ./my-app --animated` produces a GIF file
- [ ] `weblet screenshot ./my-app --animated --duration 3` produces 3-second GIF
- [ ] `weblet screenshot ./my-app --animated --interactions demo.json` executes script
- [ ] `weblet screenshot ./my-app --update-manifest` adds paths to APP.md
- [ ] `weblet screenshot ./my-app --route /settings` captures non-root route
- [ ] First run prompts to install Playwright if missing
- [ ] Works without ffmpeg (degraded GIF quality)
- [ ] Screenshots match viewport presets within 1px
- [ ] GIF file size under 5MB for 5-second capture at default settings

---

## 8. Test Scenarios

### 8.1 Basic Screenshot Capture

```typescript
test("captures desktop and mobile screenshots by default", async () => {
  await $`weblet screenshot ./examples/hello-world`;

  expect(file("./examples/hello-world/assets/screenshots/desktop.png")).toExist();
  expect(file("./examples/hello-world/assets/screenshots/mobile.png")).toExist();

  const desktop = await imageSize("./examples/hello-world/assets/screenshots/desktop.png");
  expect(desktop.width).toBe(1280);
  expect(desktop.height).toBeGreaterThanOrEqual(800);
});
```

### 8.2 Custom Viewport Size

```typescript
test("captures custom viewport size", async () => {
  await $`weblet screenshot ./examples/counter --sizes 800x600`;

  const img = await imageSize("./examples/counter/assets/screenshots/800x600.png");
  expect(img.width).toBe(800);
});
```

### 8.3 Animated GIF Capture

```typescript
test("captures animated GIF", async () => {
  await $`weblet screenshot ./examples/freecell --animated --duration 3`;

  const gif = file("./examples/freecell/assets/screenshots/preview.gif");
  expect(gif).toExist();
  expect(gif.size).toBeLessThan(5 * 1024 * 1024); // Under 5MB

  const thumb = file("./examples/freecell/assets/screenshots/preview-thumb.png");
  expect(thumb).toExist();
});
```

### 8.4 Interaction Script

```typescript
test("executes interaction script during GIF capture", async () => {
  const script = {
    actions: [
      { type: "click", selector: "#btn-new" },
      { type: "wait", duration: 1000 }
    ]
  };
  await Bun.write("./test-interactions.json", JSON.stringify(script));

  await $`weblet screenshot ./examples/freecell --animated --interactions ./test-interactions.json`;

  // Visual verification would be manual, but file should exist
  expect(file("./examples/freecell/assets/screenshots/preview.gif")).toExist();
});
```

### 8.5 Manifest Update

```typescript
test("updates APP.md with screenshot paths", async () => {
  await $`weblet screenshot ./examples/counter --update-manifest`;

  const manifest = await parseAppMd("./examples/counter/APP.md");
  expect(manifest.screenshots).toContain("assets/screenshots/desktop.png");
  expect(manifest.screenshots).toContain("assets/screenshots/mobile.png");
});
```

### 8.6 Lazy Playwright Installation

```typescript
test("prompts to install Playwright on first use", async () => {
  // Mock missing Playwright
  const result = await $`weblet screenshot ./examples/hello-world`.text();

  // Should either work (if installed) or prompt
  expect(result).toMatch(/Installing Playwright|screenshots captured/);
});
```

### 8.7 Browser Runtime Weblet

```typescript
test("captures browser-runtime weblet using static server", async () => {
  await $`weblet screenshot ./examples/hello-world`;

  expect(file("./examples/hello-world/assets/screenshots/desktop.png")).toExist();
});
```

### 8.8 Bun Runtime Weblet

```typescript
test("captures bun-runtime weblet using serve.ts", async () => {
  await $`weblet screenshot ./examples/freecell`;

  expect(file("./examples/freecell/assets/screenshots/desktop.png")).toExist();
});
```

---

## 9. Future Considerations

- **Parallel Capture**: Capture multiple viewports simultaneously for speed
- **Cloud Rendering**: Option to use cloud browsers for CI/CD environments
- **Video Export**: WebM/MP4 export in addition to GIF
- **Diff Detection**: Compare screenshots to detect visual regressions
- **Lighthouse Integration**: Capture performance metrics alongside screenshots
- **Theme Variants**: Capture both light and dark mode automatically
- **Localization**: Capture screenshots in multiple locales
