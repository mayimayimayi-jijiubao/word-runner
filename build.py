#!/usr/bin/env python3
"""构建脚本：把 src/ 下的模块拼回单文件 HTML 产物。

    python3 build.py          # 生成 index.html 与 control_panel.html
    python3 build.py --check  # 只校验产物与 src 是否一致（不写文件），CI/测试用

产物就是发布形态：index.html 仍可被 control_panel 的「下载分享」抓取注入，
拼装只做占位符替换，不改动任何字节，因此对外契约（</head> 注入点、<title> 替换）不变。

规则：改代码只改 src/，改完跑本脚本；js/ 目录下的片段按文件名排序拼接，
它们共享同一个 <script> 块（游戏引擎是一个大 IIFE，片段不是独立模块）。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGETS = {
    "index.html": ROOT / "src" / "game",
    "control_panel.html": ROOT / "src" / "panel",
}


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def assemble(src_dir: Path) -> str:
    template = read(src_dir / "template.html")
    css = read(src_dir / "styles.css")
    js = "".join(read(p) for p in sorted((src_dir / "js").glob("*.js")))
    for marker, content in (("@@CSS@@\n", css), ("@@JS@@\n", js)):
        if marker not in template:
            raise SystemExit(f"❌ {src_dir}/template.html 缺少占位符 {marker.strip()}")
        template = template.replace(marker, content, 1)
    return template


def main() -> int:
    check_only = "--check" in sys.argv
    dirty = []
    for out_name, src_dir in TARGETS.items():
        out_path = ROOT / out_name
        built = assemble(src_dir)
        current = read(out_path) if out_path.exists() else None
        if built == current:
            print(f"✓ {out_name} 已是最新")
        elif check_only:
            dirty.append(out_name)
            print(f"✗ {out_name} 与 src/ 不一致（有人直接改了产物，或 src 改后未构建）")
        else:
            out_path.write_text(built, encoding="utf-8")
            print(f"✍️  已生成 {out_name} ({len(built)} bytes)")
    if check_only and dirty:
        print("\n请运行 python3 build.py 重新生成，或把手改的产物内容移回 src/。")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
