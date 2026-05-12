<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy zip format memory

When creating an Amplify/static deploy zip for this project, build the app first with `npm run build`, then zip the contents of `out/` at the archive root. Do not zip the project source folder, `out/` as a parent folder, `.next`, `node_modules`, `output`, old zip files, or `.git`.

Important: create the zip with POSIX forward-slash entry paths such as `assets/yuzu-logo.png` and `_next/static/...`. PowerShell `Compress-Archive` can store Windows backslash paths like `assets\yuzu-logo.png`, which makes Amplify serve `index.html` but 404 the CSS, JS, and image assets. Use a zip method that writes forward-slash paths, such as Python `zipfile` with `path.relative_to(out_dir).as_posix()`.
