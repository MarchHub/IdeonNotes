import json
from abc import ABC, abstractmethod

import httpx


class BaseLLM(ABC):
    @abstractmethod
    def generate_json(self, prompt: str, system_prompt: str = "") -> dict:
        """强制大模型输出 JSON 格式"""
        pass


class OllamaClient(BaseLLM):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model

    def generate_json(self, prompt: str, system_prompt: str = "") -> dict:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "format": "json",  # 强制 Ollama 返回 JSON
        }

        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                result_text = response.json().get("response", "{}")
                return json.loads(result_text)
        except Exception as e:
            print(f"[Ollama Error] {e}")
            return {}


# class OpenAIClient(BaseLLM):
#     """预留外部服务商 API 接口"""
#     def __init__(self, api_key: str, base_url: str, model: str):
#         self.api_key = api_key
#         self.base_url = base_url
#         self.model = model

#     def generate_json(self, prompt: str, system_prompt: str = "") -> dict:
#         # 这里可以使用 httpx 调用外部提供商的 v1/chat/completions 接口
#         # 并设置 response_format 为 { "type": "json_object" }
#         pass


def get_llm_client(provider: str, **kwargs) -> BaseLLM:
    if provider == "ollama":
        return OllamaClient(base_url=kwargs["base_url"], model=kwargs["model"])
    # elif provider == "openai":
    #     return OpenAIClient(api_key=kwargs['api_key'], base_url=kwargs['base_url'], model=kwargs['model'])
    raise ValueError(f"Unknown LLM provider: {provider}")
