"""Check that the visual comparison preserves the two input images at native size."""

import subprocess
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


class ScreenshotComparisonTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.reference = self.folder / 'reference.png'
        self.rendered = self.folder / 'rendered.png'
        self.output = self.folder / 'comparison.png'
        Image.new('RGB', (7, 5), 'red').save(self.reference)

    def compare(self, *extra):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name('compare_screenshots.py')),
             str(self.reference), str(self.rendered), '--output', str(self.output), *map(str, extra)],
            capture_output=True, text=True,
        )

    def test_panels_keep_all_pixels_in_order(self):
        rendered = Image.new('RGB', (7, 5), 'blue')
        rendered.putpixel((6, 4), (37, 12, 241))
        rendered.save(self.rendered)
        result = self.compare()
        self.assertEqual(result.returncode, 0, result.stderr)
        with Image.open(self.output) as comparison, Image.open(self.reference) as original:
            self.assertEqual(comparison.size, (14, 5))
            self.assertEqual(comparison.crop((0, 0, 7, 5)).tobytes(), original.tobytes())
            self.assertEqual(comparison.crop((7, 0, 14, 5)).tobytes(), rendered.tobytes())

    def test_wrong_size_requires_recapture(self):
        Image.new('RGB', (14, 10)).save(self.rendered)
        result = self.compare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('14×10', result.stderr)
        self.assertIn('7×5', result.stderr)
        self.assertFalse(self.output.exists())

    def test_uses_display_orientation_and_white_for_transparency(self):
        rotated = Image.new('RGBA', (5, 7), (0, 0, 0, 0))
        rotated.putpixel((0, 0), (17, 25, 48, 255))
        orientation = Image.Exif()
        orientation[274] = 6
        rotated.save(self.rendered, exif=orientation)
        result = self.compare()
        self.assertEqual(result.returncode, 0, result.stderr)
        with Image.open(self.output) as comparison:
            self.assertEqual(comparison.getpixel((13, 0)), (17, 25, 48))
            self.assertEqual(comparison.getpixel((7, 0)), (255, 255, 255))

    def test_inputs_cannot_be_overwritten(self):
        Image.new('RGB', (7, 5), 'green').save(self.rendered)
        self.output = self.reference
        before = self.reference.read_bytes()
        self.assertNotEqual(self.compare().returncode, 0)
        self.assertEqual(self.reference.read_bytes(), before)

    def test_regions_find_local_error_and_keep_native_crops(self):
        reference = Image.new('RGB', (7, 5), 'black')
        reference.save(self.reference)
        rendered = reference.copy()
        for y in range(2):
            for x in range(3):
                rendered.putpixel((x, y), (30, 60, 90))
        rendered.save(self.rendered)
        regions = self.folder / 'regions.json'
        regions.write_text(json.dumps([
            {'name': 'changed', 'box': [0, 0, 3, 2]},
            {'name': 'unchanged', 'box': [3, 0, 4, 5]},
        ]))
        details = self.folder / 'details'
        result = self.compare('--regions', regions, '--details', details)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads((details / 'metrics.json').read_text())
        self.assertEqual(report['size'], [7, 5])
        self.assertAlmostEqual(report['overall']['mae'], 60 * 6 / 35, places=4)
        self.assertEqual([r['mae'] for r in report['regions']], [60, 0])
        with Image.open(details / report['regions'][0]['comparison']) as crop:
            self.assertEqual(crop.size, (6, 2))
            self.assertEqual(crop.crop((3, 0, 6, 2)).tobytes(), rendered.crop((0, 0, 3, 2)).tobytes())
        with Image.open(details / 'difference.png') as diff:
            self.assertEqual(diff.size, (7, 5))
            self.assertNotEqual(diff.getpixel((0, 0)), diff.getpixel((6, 4)))

    def test_invalid_regions_do_not_create_outputs(self):
        Image.new('RGB', (7, 5), 'blue').save(self.rendered)
        regions = self.folder / 'regions.json'
        details = self.folder / 'details'
        for box in [[-1, 0, 3, 2], [0, 0, 8, 2], [0, 0, 3, 0], [0.5, 0, 3, 2], [True, 0, 3, 2]]:
            with self.subTest(box=box):
                regions.write_text(json.dumps([{'name': 'bad', 'box': box}]))
                self.assertNotEqual(self.compare('--regions', regions, '--details', details).returncode, 0)
                self.assertFalse(self.output.exists())
                self.assertFalse(details.exists())

    def test_existing_detail_output_is_preserved_without_partial_pair(self):
        Image.new('RGB', (7, 5), 'blue').save(self.rendered)
        details = self.folder / 'details'
        details.mkdir()
        sentinel = details / 'metrics.json'
        sentinel.write_text('previous comparison')
        result = self.compare('--details', details)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sentinel.read_text(), 'previous comparison')
        self.assertFalse(self.output.exists())

    def test_regions_require_detail_output(self):
        Image.new('RGB', (7, 5), 'blue').save(self.rendered)
        regions = self.folder / 'regions.json'
        regions.write_text('[]')
        self.assertNotEqual(self.compare('--regions', regions).returncode, 0)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
