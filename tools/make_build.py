#!/usr/bin/env python3
"""Build the Web demo without the Godot editor binary.

1. Packs project resources into a Godot PCK (format v4, exactly matching
   Godot 4.7's `EditorExportPlatform::save_pack` writer and
   `PackedSourcePCK` reader).
2. Assembles build/web/: official nothreads Web template runtime
   (web/vendor), the custom shell page and the pack.

Usage: python3 tools/make_build.py
"""
import hashlib
import pathlib
import shutil
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / "build" / "web"
ENGINE_VERSION = (4, 7, 2)
MAGIC = 0x43504447  # "GDPC"
PACK_FORMAT_VERSION = 4
PACK_REL_FILEBASE = 2
PCK_PADDING = 16

INCLUDE_FILES = [
    "project.godot",
    "scenes/main.tscn",
    "assets/NotoSansSC-Regular.ttf",
] + sorted(str(p.relative_to(ROOT)).replace("\\", "/") for p in (ROOT / "scripts").glob("*.gd"))

VENDOR_FILES = [
    "godot.web.template_release.wasm32.nothreads.js",
    "godot.web.template_release.wasm32.nothreads.wasm",
    "audio.worklet.js",
    "audio.position.worklet.js",
]


def pad_to(f, align: int) -> None:
    while f.tell() % align:
        f.write(b"\0")


def build_pck(out_path: pathlib.Path) -> int:
    entries = []
    with open(out_path, "wb") as f:
        # --- header (100 bytes, mirrors EditorExportPlatform::_store_header)
        f.write(struct.pack("<IIIII", MAGIC, PACK_FORMAT_VERSION, *ENGINE_VERSION))
        f.write(struct.pack("<I", PACK_REL_FILEBASE))
        file_base_pos = f.tell()
        f.write(struct.pack("<Q", 0))  # files base (patched below)
        dir_ofs_pos = f.tell()
        f.write(struct.pack("<Q", 0))  # directory offset (patched below)
        f.write(b"\0" * (16 * 4))  # reserved
        pad_to(f, PCK_PADDING)

        # --- file data section
        file_base = f.tell()
        for rel in INCLUDE_FILES:
            data = (ROOT / rel).read_bytes()
            ofs = f.tell() - file_base
            f.write(data)
            pad_to(f, PCK_PADDING)
            entries.append((rel, ofs, len(data), hashlib.md5(data).digest()))

        # --- directory section
        pad_to(f, PCK_PADDING)
        dir_offset = f.tell()
        f.write(struct.pack("<I", len(entries)))
        for rel, ofs, size, md5 in sorted(entries):
            pb = rel.encode("utf-8")
            pad = (-len(pb)) % 4
            f.write(struct.pack("<I", len(pb) + pad))
            f.write(pb + b"\0" * pad)
            f.write(struct.pack("<QQ", ofs, size))  # ofs relative to file_base
            f.write(md5)
            f.write(struct.pack("<I", 0))  # flags: none

        # --- patch header offsets (pack starts at 0, so relative == absolute)
        f.seek(file_base_pos)
        f.write(struct.pack("<Q", file_base))
        f.seek(dir_ofs_pos)
        f.write(struct.pack("<Q", dir_offset))

    return len(entries)


def assemble() -> None:
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir(parents=True)
    for name in VENDOR_FILES:
        shutil.copy2(ROOT / "web" / "vendor" / name, BUILD / name)
    shutil.copy2(ROOT / "web" / "shell.html", BUILD / "index.html")


def main() -> int:
    assemble()
    pck_path = BUILD / "game.pck"
    n = build_pck(pck_path)
    print(f"game.pck written: {n} files, {pck_path.stat().st_size} bytes")
    for rel in INCLUDE_FILES:
        print(f"  + {rel}")
    print(f"web build ready: {BUILD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
