#!/usr/bin/env python3
"""构建守护测试：python3 tests/test_build.py

1. 产物与 src/ 一致（防止直接手改 index.html / control_panel.html 造成漂移）；
2. index.html 保留 control_panel「下载分享」依赖的注入契约；
3. workbench 不再引用 CDN，vendor 文件齐全。
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
failures = []


def check(name, ok, detail=""):
    print(("✓ " if ok else "✗ ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


# 1. 产物 == src 构建结果
r = subprocess.run([sys.executable, str(ROOT / "build.py"), "--check"], capture_output=True, text=True)
check("build --check：产物与 src/ 一致", r.returncode == 0, r.stdout.strip())

# 2. 导出注入契约（control_panel.downloadShare 依赖这两个锚点）
game = (ROOT / "index.html").read_text(encoding="utf-8")
check("index.html 含 </head> 注入锚点", "</head>" in game)
check("index.html 含 <title>字跑大师</title>", "<title>字跑大师</title>" in game)
check("index.html 引擎读取 window.OFFLINE_CONFIG", "window.OFFLINE_CONFIG" in game)
check("index.html 使用 WRM_UserConfig 存储键", "WRM_UserConfig" in game)

# 3. 离线依赖
wb = (ROOT / "workbench.html").read_text(encoding="utf-8")
check("workbench 无 jsdelivr CDN 脚本依赖", "cdn.jsdelivr.net" not in wb)
for f in ("vendor/pdfjs/pdf.min.js", "vendor/pdfjs/pdf.worker.min.js", "vendor/pinyin-pro-3.18.2.min.js"):
    check(f"vendor 文件存在: {f}", (ROOT / f).is_file() and (ROOT / f).stat().st_size > 10000)

if failures:
    print(f"\n❌ {len(failures)} 项失败")
    sys.exit(1)
print("\n✅ 全部通过")
