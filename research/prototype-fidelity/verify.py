from collections import Counter
from pathlib import Path
import hashlib
import json
import re
import struct

root = Path(__file__).resolve().parent
inventory = json.loads((root / 'inventory.json').read_text())
counts = Counter(row['outcome'] for section in inventory for row in section['elements'])
assert set(counts) == {'present', 'coming', 'cut', 'missing'}
report = (root / 'README.md').read_text()
rows = re.findall(r'^\| E\d+ \|', report, re.M)
assert len(rows) == sum(counts.values())
assert '—' not in report
assert not re.search(r'(?<![`\w])@[A-Za-z][\w-]*', report)
for target in re.findall(r'\]\(([^)]+)\)', report):
    if '://' not in target:
        assert (root / target).is_file(), target
manifest = json.loads((root / 'screenshots.json').read_text())
assert len({shot['name'] for shot in manifest}) == len(manifest)
for shot in manifest:
    file = root / shot['file']
    data = file.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', file
    assert struct.unpack('>II', data[16:24]) == (shot['width'], shot['height']), file
    assert shot['sha256'] == hashlib.sha256(data).hexdigest(), file
for file in (root / 'screenshots').glob('compare-*.png'):
    assert file.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', file
for theme in ['light', 'dark']:
    for screen in ['home8', 'home1', 'quests', 'leaderboard', 'skills', 'book-overview', 'book-category', 'book-album', 'collection', 'inventory', 'sign-in', 'palette', 'locked', 'moment-level']:
        assert (root / 'screenshots' / f'compare-{screen}-{theme}.png').is_file()
print(f'{len(rows)} inventory rows: {dict(counts)}')
print(f'{len(manifest)} original captures and 28 comparison PNGs verified')
print('All report links resolve; screenshot signatures, dimensions and hashes match')
