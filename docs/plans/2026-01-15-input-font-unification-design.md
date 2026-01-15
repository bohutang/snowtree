# Input Font Unification Design

## Goal
Unify the font used in the input editor content/placeholder and the two hint rows
(agent/mode/model line and tab/shift+tab hints) by referencing a single
configurable token that can later be overridden from user JSON settings.

## Scope
- Input editor content and placeholder typography.
- Input metadata line (agent/mode/model/version).
- Input hints line (tab/shift+tab help).

Out of scope: other monospace areas such as diffs, command output, and timeline
panels.

## Approach
Introduce a dedicated CSS custom property `--st-font-input-mono` alongside
existing typography tokens. Define a reusable utility class `.st-input-mono` that
applies the shared font family via the custom property with a safe fallback.
Apply the class to the two hint rows and use the token in the Tiptap editor
inline styles and placeholder rule so all three surfaces inherit the same font
source.

## Alternatives Considered
- Reusing `--st-font-mono`: rejected to avoid changing monospace typography
  elsewhere.
- Hardcoding Monaco in each place: rejected to keep future JSON-driven font
  overrides centralized.

## Testing
Add a focused UI test to assert the shared font token is used by the editor and
that the hint rows opt into the shared monospace class.

## Rollout
This is a low-risk, purely visual change. Manual verification is to confirm the
input content, placeholder, and hints render in Monaco when the token is set.
