#!/usr/bin/env python3
import os
import zipfile
from pathlib import Path

# 获取脚本所在目录
script_dir = Path(__file__).parent
project_root = script_dir.parent

extension_dir = project_root / 'extension'
output_path = project_root / 'public' / 'extension.zip'

# 确保 public 目录存在
(project_root / 'public').mkdir(exist_ok=True)

# 创建 zip 文件
with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # 遍历 extension 目录下的所有文件
    for root, dirs, files in os.walk(extension_dir):
        for file in files:
            file_path = Path(root) / file
            # 计算相对路径
            arcname = file_path.relative_to(extension_dir)
            zipf.write(file_path, arcname)
            print(f"Added: {arcname}")

print(f"\n✅ Extension packaged successfully!")
print(f"   Output: {output_path}")
print(f"   Size: {output_path.stat().st_size / 1024:.2f} KB")

