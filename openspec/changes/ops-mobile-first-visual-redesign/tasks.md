## 1. Discovery and layout baseline

- [x] 1.1 Audit current `/ops` structure and identify horizontal overflow sources on 320px, 375px, 768px, and 1024px breakpoints.
- [x] 1.2 Map `/ops` containers to mobile-first layout primitives and define breakpoint behavior per section.
- [x] 1.3 Confirm `ui-cognitive` canonical tokens/breakpoints to reuse for `/ops`.

## 2. Mobile-first container implementation

- [x] 2.1 Implement mobile-first `/ops` layout scaffold that defaults to single-column flow.
- [x] 2.2 Add mobile container variants (stacked/cards) for key desktop panel groups.
- [x] 2.3 Ensure content parity between mobile and desktop variants for core operational information.

## 3. Desktop refinement and visual consistency

- [x] 3.1 Refine desktop panel spacing, alignment, and hierarchy without changing workflow paths.
- [x] 3.2 Replace local style deviations with existing `ui-cognitive` tokens for color, spacing, typography, radius, and elevation.
- [x] 3.3 Add minimal new semantic tokens only when no existing token satisfies the need.

## 4. Accessibility baseline

- [x] 4.1 Add or verify semantic landmarks/headings for `/ops` sections.
- [x] 4.2 Ensure visible keyboard focus indicators and logical tab order across interactive controls.
- [x] 4.3 Validate baseline contrast for primary text and controls; adjust tokens/styles where needed.

## 5. Validation and acceptance

- [x] 5.1 Validate no horizontal scroll and correct container variants on mobile breakpoints.
- [x] 5.2 Validate desktop refinement, content visibility, and token consistency on desktop breakpoints.
- [x] 5.3 Run targeted UI checks and capture acceptance evidence for desktop + mobile completion criteria.
