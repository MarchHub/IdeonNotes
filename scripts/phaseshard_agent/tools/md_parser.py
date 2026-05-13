import re
from pathlib import Path
from typing import Any, Dict

import yaml


class MarkdownParser:
    """处理带有 Frontmatter 和双向链接的 Markdown"""

    @staticmethod
    def parse(file_path: Path) -> Dict[str, Any]:
        content = file_path.read_text(encoding="utf-8")

        # 1. 提取 YAML Frontmatter
        frontmatter = {}
        body = content
        fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if fm_match:
            try:
                frontmatter = yaml.safe_load(fm_match.group(1)) or {}
                body = content[fm_match.end() :]
            except yaml.YAMLError:
                pass

        # 2. 提取双向链接 [[知识点]]
        hard_links = re.findall(r"\[\[(.*?)\]\]", body)

        # 3. 提取纯文本用于喂给大模型 (去掉太长的代码块以节约上下文)
        clean_body = re.sub(r"```.*?```", "[代码块省略]", body, flags=re.DOTALL)

        return {
            "title": file_path.stem,
            "path": str(file_path),
            "frontmatter": frontmatter,
            "links": list(set(hard_links)),
            "content": clean_body[:2000],  # 截断前2000字足以生成摘要
        }
