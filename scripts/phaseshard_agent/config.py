from pathlib import Path

# 根目录配置 (yuufrag 仓库目录)
PROJECT_ROOT = Path(__file__).parent.parent.parent
POSTS_DIR = PROJECT_ROOT / "posts"
OUTPUT_JSON = PROJECT_ROOT / "public" / "phaseshard.json"

# LLM 配置
LLM_PROVIDER = "ollama"
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen2.5:14b"
