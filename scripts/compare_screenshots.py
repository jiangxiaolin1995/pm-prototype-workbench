"""Place the source screenshot and a real workbench capture side by side at native size."""

import argparse
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageCms, ImageOps
except ImportError:
    raise SystemExit('制作对照图需要 Pillow。请使用已安装 Pillow 的 Python 3。')


def display_image(path):
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        rgba = image.convert('RGBA')
        rgb = rgba.convert('RGB')
        profile = image.info.get('icc_profile')
        if profile:
            rgb = ImageCms.profileToProfile(
                rgb, ImageCms.ImageCmsProfile(BytesIO(profile)),
                ImageCms.createProfile('sRGB'), outputMode='RGB',
            )
        canvas = Image.new('RGB', image.size, 'white')
        canvas.paste(rgb, mask=rgba.getchannel('A'))
        return canvas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path, help='原始截图')
    parser.add_argument('rendered', type=Path, help='工作台业务区域实截')
    parser.add_argument('--output', required=True, type=Path, help='新的 PNG 对照图')
    args = parser.parse_args()
    if args.output.suffix.lower() != '.png':
        parser.error('请使用 .png 对照图路径')
    try:
        reference = display_image(args.reference)
        rendered = display_image(args.rendered)
        w, h = reference.size
        if rendered.size != reference.size:
            parser.error(f'原图 {w}×{h}，实截 {rendered.width}×{rendered.height}。请按原图尺寸重新截图。')
        pair = Image.new('RGB', (w * 2, h))
        pair.paste(reference, (0, 0))
        pair.paste(rendered, (w, 0))
        with args.output.open('xb') as stream:
            try:
                pair.save(stream, format='PNG')
            except OSError:
                args.output.unlink()
                raise
    except (OSError, ValueError, ImageCms.PyCMSError) as error:
        parser.exit(1, f'{error}\n')
    print(f'左为原图，右为工作台实截，每张 {w}×{h} px。{args.output}')


if __name__ == '__main__':
    main()
