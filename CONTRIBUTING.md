# Contributing to unstable-text

Thanks for considering a contribution! This project is small and
early-stage, so contributions of any size are welcome — typo fixes,
bug reports, new effect presets, or bigger features.

## Getting started

1. Fork the repo and clone your fork:
   ```
   git clone https://github.com/patrick856/unstable-text.git
   cd unstable-text
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Run the build:
   ```
   npm run build
   ```
4. Open `index.html` (or the demo site, if included) in a browser to
   see the effects running live while you work.

## Making changes

1. Create a branch for your change:
   ```
   git checkout -b fix/short-description
   ```
2. Make your changes in `src/`.
3. Rebuild and manually test in the browser — there's currently no
   automated test suite, so please verify your change visually before
   opening a PR.
4. Keep changes focused — one fix or feature per PR is easier to
   review than several unrelated changes bundled together.

## Submitting a pull request

1. Push your branch and open a PR against `main`.
2. Describe what changed and why in the PR description.
3. Mention how you tested it (e.g. "tested in Chrome, ambient scheduler
   with default config").
4. Be patient — this is a side project, so review may take a few days.

## Reporting bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce (a minimal code snippet or repro link helps a lot)
- Browser/environment if relevant

## Suggesting features

Open an issue describing the idea and the use case behind it. Small,
well-scoped suggestions (a new effect preset, a new config option) are
easier to discuss and merge than large architectural changes.

## Code style

- Match the existing code style in the file you're editing.
- Prefer small, readable functions over clever one-liners.
- Keep the core library dependency-free where possible.

## Questions

If anything here is unclear, open an issue and ask — no need to have
it all figured out before contributing.
