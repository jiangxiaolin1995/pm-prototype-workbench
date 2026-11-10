"""Compare a source screenshot and a real workbench capture at native size, optionally by region."""

import argparse
import json
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageCms, ImageOps, ImageStat
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


def read_regions(path, size):
    if path is None:
        return []
    entries = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(entries, list):
        raise ValueError('分区文件须为 JSON 数组')
    names = set()
    for item in entries:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip():
            raise ValueError('每个分区须有非空 name')
        if item['name'] in names:
            raise ValueError('分区 name 不能重复')
        names.add(item['name'])
        box = item.get('box')
        if not isinstance(box, list) or len(box) != 4 or any(type(n) is not int for n in box):
            raise ValueError('分区 box 须为整数 [x, y, width, height]')
        x, y, w, h = box
        if min(x, y) < 0 or min(w, h) <= 0 or x + w > size[0] or y + h > size[1]:
            raise ValueError('分区须完全位于原图内且宽高大于零')
    return entries


def pair_image(reference, rendered):
    pair = Image.new('RGB', (reference.width * 2, reference.height))
    pair.paste(reference, (0, 0))
    pair.paste(rendered, (reference.width, 0))
    return pair


def difference(reference, rendered):
    diff = ImageChops.difference(reference, rendered)
    # A readable visual aid, not an accuracy score. Metric uses all RGB channels.
    heat = ImageOps.colorize(diff.convert('L').point(lambda value: min(255, value * 4)), '#f8f7f5', '#d6234e')
    mae = round(sum(ImageStat.Stat(diff).mean) / 3, 6)
    return heat, mae


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path, help='原始截图')
    parser.add_argument('rendered', type=Path, help='工作台业务区域实截')
    parser.add_argument('--output', required=True, type=Path, help='新的 PNG 对照图')
    parser.add_argument('--regions', type=Path, help='可选分区 JSON：[{"name":"区域", "box":[x,y,width,height]}]')
    parser.add_argument('--details', type=Path, help='新的目录，用于差异图、分区对照和 metrics.json')
    args = parser.parse_args()
    if args.output.suffix.lower() != '.png':
        parser.error('请使用 .png 对照图路径')
    if args.regions and not args.details:
        parser.error('--regions 需要同时指定 --details')
    created = []
    made_directory = False
    try:
        reference = display_image(args.reference)
        rendered = display_image(args.rendered)
        w, h = reference.size
        if rendered.size != reference.size:
            parser.error(f'原图 {w}×{h}，实截 {rendered.width}×{rendered.height}。请按原图尺寸重新截图。')
        regions = read_regions(args.regions, reference.size)
        if args.output.exists() or (args.details and args.details.exists()):
            raise ValueError('输出已存在，请为本轮对照使用新文件名和新目录')
        if args.details:
            args.details.mkdir()
            made_directory = True
        with args.output.open('xb') as stream:
            created.append(args.output)
            pair_image(reference, rendered).save(stream, format='PNG')
        if args.details:
            def save(image, name):
                dest = args.details / name
                with dest.open('xb') as stream:
                    created.append(dest)
                    image.save(stream, format='PNG')
            heat, mae = difference(reference, rendered)
            save(heat, 'difference.png')
            report = {'size': [w, h], 'metric': 'rgb_mean_absolute_error', 'range': [0, 255],
                      'interpretation': 'Lower is closer; not an accuracy percentage or interaction test.',
                      'overall': {'mae': mae}, 'difference': 'difference.png', 'regions': []}
            for index, item in enumerate(regions, 1):
                x, y, rw, rh = item['box']
                box = (x, y, x + rw, y + rh)
                left, right = reference.crop(box), rendered.crop(box)
                heat, mae = difference(left, right)
                pair_name, diff_name = f'region-{index:02d}.png', f'region-{index:02d}-diff.png'
                save(pair_image(left, right), pair_name)
                save(heat, diff_name)
                report['regions'].append({'name': item['name'], 'box': item['box'], 'mae': mae,
                                          'comparison': pair_name, 'difference': diff_name})
            with (args.details / 'metrics.json').open('x', encoding='utf-8') as stream:
                created.append(args.details / 'metrics.json')
                json.dump(report, stream, ensure_ascii=False, indent=2)
    except (OSError, ValueError, ImageCms.PyCMSError) as error:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        if made_directory:
            args.details.rmdir()
        parser.exit(1, f'{error}\n')
    print(f'左为原图，右为工作台实截，每张 {w}×{h} px。{args.output}')
    if args.details:
        print(f'分区对照、差异图和 RGB 平均绝对误差：{args.details}。误差不是还原率。')


if __name__ == '__main__':
    main()
