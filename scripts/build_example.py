#!/usr/bin/env python3
"""Build a demonstration from the same shell used by real prototypes."""
import argparse
from pathlib import Path
from workbench_source import example_source

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('example',choices=['channel-review','h5'])
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    source=example_source(args.example)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open('x') as stream: stream.write(source)
        print(args.output.resolve())
    else:
        print(source)

if __name__=='__main__': main()
