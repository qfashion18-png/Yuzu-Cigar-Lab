#!/usr/bin/env python3
"""Build and package the static Amplify artifact with POSIX zip entries."""

from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
import zipfile
from pathlib import Path


DISALLOWED_PREFIXES = ("out/", ".next/", "node_modules/", "output/", ".git/")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package out/ for Amplify static hosting.")
    parser.add_argument("--skip-build", action="store_true", help="Use the existing out/ directory.")
    parser.add_argument("--output-dir", default=".", help="Directory for the generated zip.")
    parser.add_argument("--name", default="", help="Zip filename. Defaults to a timestamped artifact name.")
    return parser.parse_args()


def run_build(workspace: Path) -> None:
    subprocess.run(["npm", "run", "build"], cwd=workspace, check=True)


def create_zip(out_dir: Path, zip_path: Path) -> int:
    entries = 0
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(out_dir.rglob("*")):
            if not path.is_file():
                continue

            entry = path.relative_to(out_dir).as_posix()
            validate_entry(entry)
            archive.write(path, entry)
            entries += 1

    return entries


def validate_entry(entry: str) -> None:
    if "\\" in entry or entry.startswith("/") or ".." in Path(entry).parts:
        raise ValueError(f"Unsafe zip entry path: {entry}")

    if entry.startswith(DISALLOWED_PREFIXES):
        raise ValueError(f"Disallowed deploy zip entry: {entry}")


def validate_zip(zip_path: Path) -> int:
    with zipfile.ZipFile(zip_path) as archive:
        entries = archive.namelist()

    if "index.html" not in entries:
        raise ValueError("Deploy zip is missing index.html at archive root.")

    if not any(entry.startswith("_next/static/") for entry in entries):
        raise ValueError("Deploy zip is missing _next/static assets at archive root.")

    for entry in entries:
        validate_entry(entry)

    return len(entries)


def default_zip_name() -> str:
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"yuzu-cigar-club-amplify-static-{timestamp}.zip"


def main() -> int:
    args = parse_args()
    workspace = Path(__file__).resolve().parents[1]
    out_dir = workspace / "out"
    output_dir = (workspace / args.output_dir).resolve()
    zip_name = args.name or default_zip_name()
    zip_path = output_dir / zip_name

    if not args.skip_build:
        run_build(workspace)

    if not out_dir.is_dir():
        print("out/ does not exist. Run npm run build first or omit --skip-build.", file=sys.stderr)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    if zip_path.exists():
        zip_path.unlink()

    written_entries = create_zip(out_dir, zip_path)
    validated_entries = validate_zip(zip_path)

    if written_entries != validated_entries:
        print("Zip entry count changed during validation.", file=sys.stderr)
        return 1

    print(f"Created {zip_path}")
    print(f"Entries: {validated_entries}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
