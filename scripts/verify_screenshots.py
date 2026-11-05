"""Check that the visual comparison preserves the two input images at native size."""

import subprocess
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

    def compare(self):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name('compare_screenshots.py')),
             str(self.reference), str(self.rendered), '--output', str(self.output)],
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


if __name__ == '__main__':
    unittest.main()
