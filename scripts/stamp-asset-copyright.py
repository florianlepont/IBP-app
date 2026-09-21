#!/usr/bin/env python3
"""Embed a copyright notice in the association's image assets.

The brand assets shipped with the app belong to the association Etats Sauvages
(see NOTICE.md). Stamping the notice inside the files themselves makes reuse
traceable and removes any "I did not know" defence if they are lifted.

Writes a PNG ``tEXt`` chunk / a JPEG ``COM`` marker. Pixels are untouched, and
the script is idempotent: a file already carrying the notice is skipped.

Usage:
    python3 scripts/stamp-asset-copyright.py mobile/assets
    python3 scripts/stamp-asset-copyright.py --check mobile/assets
"""

import argparse
import pathlib
import struct
import sys
import zlib

NOTICE = (
    "Copyright (c) Association Etats Sauvages. All rights reserved. "
    "Not licensed for reuse - see NOTICE.md in the IBP app repository."
)
MARKER = "Association Etats Sauvages"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_chunks(data):
    offset = len(PNG_SIGNATURE)
    while offset < len(data):
        (length,) = struct.unpack(">I", data[offset : offset + 4])
        ctype = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        yield ctype, data[offset:end]
        offset = end


def stamp_png(data):
    if MARKER.encode("latin-1") in data:
        return None
    payload = b"Copyright\x00" + NOTICE.encode("latin-1", "replace")
    chunk = (
        struct.pack(">I", len(payload))
        + b"tEXt"
        + payload
        + struct.pack(">I", zlib.crc32(b"tEXt" + payload) & 0xFFFFFFFF)
    )
    out, inserted = bytearray(PNG_SIGNATURE), False
    for ctype, raw in png_chunks(data):
        out += raw
        if ctype == b"IHDR" and not inserted:
            out += chunk
            inserted = True
    return bytes(out) if inserted else None


def stamp_jpeg(data):
    if MARKER.encode("latin-1") in data:
        return None
    if not data.startswith(b"\xff\xd8"):
        return None
    payload = NOTICE.encode("latin-1", "replace") + b"\x00"
    comment = b"\xff\xfe" + struct.pack(">H", len(payload) + 2) + payload
    return data[:2] + comment + data[2:]


STAMPERS = {".png": stamp_png, ".jpg": stamp_jpeg, ".jpeg": stamp_jpeg}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=pathlib.Path)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report unstamped files and exit 1 instead of writing",
    )
    args = parser.parse_args()

    files = []
    for path in args.paths:
        if path.is_dir():
            files += [p for p in sorted(path.rglob("*")) if p.suffix.lower() in STAMPERS]
        elif path.suffix.lower() in STAMPERS:
            files.append(path)

    stamped, skipped, failed = [], [], []
    for path in files:
        data = path.read_bytes()
        try:
            result = STAMPERS[path.suffix.lower()](data)
        except Exception as exc:  # noqa: BLE001 - report, never abort the batch
            failed.append((path, exc))
            continue
        if result is None:
            skipped.append(path)
        elif args.check:
            stamped.append(path)
        else:
            path.write_bytes(result)
            stamped.append(path)

    verb = "missing notice" if args.check else "stamped"
    print(f"{len(stamped)} {verb}, {len(skipped)} already stamped, {len(failed)} failed")
    for path, exc in failed:
        print(f"  FAILED {path}: {exc}", file=sys.stderr)
    if failed or (args.check and stamped):
        for path in stamped if args.check else []:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
