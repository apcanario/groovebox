#!/usr/bin/env python3
"""Walk an MP3 file frame by frame: every frame header must be valid and follow the one before.

Usage: python3 tools/mp3check.py file.mp3
Prints frames, sample rate, bitrate and duration; exits 1 if the file is not a clean MPEG-1 Layer III stream.
"""
import sys

BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]  # MPEG-1 Layer III, kbps
RATES = [44100, 48000, 32000, 0]


def mp3_info(data: bytes) -> dict:
    """Frames, sample rate, kbps set, duration in seconds, and the first problem found (or None)."""
    i = 0
    if data[:3] == b"ID3" and len(data) >= 10:
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        i = 10 + size
    frames = 0
    rates = set()
    kbps = set()
    error = None
    while i + 4 <= len(data):
        h = data[i : i + 4]
        if h[0] != 0xFF or (h[1] & 0xE0) != 0xE0:
            error = f"lost frame sync at byte {i} of {len(data)}"
            break
        version = (h[1] >> 3) & 3
        layer = (h[1] >> 1) & 3
        if version != 3 or layer != 1:
            error = f"frame {frames} is not MPEG-1 Layer III"
            break
        br = BITRATES[h[2] >> 4]
        sr = RATES[(h[2] >> 2) & 3]
        if not br or not sr:
            error = f"frame {frames} has a bad bitrate or sample rate"
            break
        pad = (h[2] >> 1) & 1
        length = 144000 * br // sr + pad
        if i + length > len(data):
            # A short last frame is a truncated file.
            error = f"last frame cut short at byte {i}"
            break
        frames += 1
        rates.add(sr)
        kbps.add(br)
        i += length
    sr = rates.pop() if len(rates) == 1 else 0
    if len(rates) > 0:
        error = error or "sample rate changes inside the file"
    return {
        "frames": frames,
        "sample_rate": sr,
        "kbps": sorted(kbps),
        "seconds": frames * 1152 / sr if sr else 0.0,
        "bytes": len(data),
        "error": error if frames else (error or "no frames"),
    }


def main() -> int:
    with open(sys.argv[1], "rb") as f:
        info = mp3_info(f.read())
    print(info)
    return 1 if info["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
