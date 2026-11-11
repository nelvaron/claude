#!/usr/bin/env python3
"""Cuts the Computer Modern Unicode faces down to the characters the Q.E.D. page can show.

    pip install fonttools brotli
    npm pack computer-modern@0.1.3 && tar xzf computer-modern-0.1.3.tgz
    python3 tools/subset-fonts.py package/fonts src/qed/fonts

The output is renamed "QED Serif" / "QED Mono": the SIL Open Font License reserves the original
family name for unmodified copies, and a subset is a modified copy.
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

LATIN = "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2027,U+2030-203A,U+2212,U+00D7"
VIETNAMESE = "U+01A0,U+01A1,U+01AF,U+01B0,U+1EA0-1EF9"
GREEK = "U+0384-03CE"
CYRILLIC = "U+0401,U+0410-044F,U+0451"

FACES = [
    # source file, output file, family, unicodes
    ("cmu-serif-500-roman.ttf", "serif-roman.woff2", "QED Serif", LATIN),
    ("cmu-serif-500-italic.ttf", "serif-italic.woff2", "QED Serif", ",".join([LATIN, VIETNAMESE, GREEK, CYRILLIC])),
    ("cmu-serif-700-roman.ttf", "serif-bold.woff2", "QED Serif", "U+0020-007E"),
    ("cmu-typewriter-text-500-roman.ttf", "mono.woff2", "QED Mono", "U+0020-007E,U+00D7,U+00B7"),
]


def rename(font: TTFont, family: str) -> None:
    for record in font["name"].names:
        if record.nameID in (1, 4, 16):
            record.string = family
        elif record.nameID == 6:
            record.string = family.replace(" ", "")


def main(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for src, out, family, unicodes in FACES:
        options = subset.Options(flavor="woff2", layout_features=["kern", "liga"], name_IDs=[0, 1, 2, 4, 6, 13])
        font = subset.load_font(str(source / src), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=subset.parse_unicodes(unicodes))
        subsetter.subset(font)
        rename(font, family)
        subset.save_font(font, str(target / out), options)
        print(f"{out}: {(target / out).stat().st_size} bytes")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
