from typing import Any


class BaseRole:
    """
    通用角色扮演引擎 (Generic Role Engine)
    通过注入不同的 System Prompt 实例化为不同的领域专家。
    """

    def __init__(self, name: str, system_prompt: str, llm_client):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = llm_client

    def execute(self, user_prompt: str, response_format: str = "json") -> Any:
        """
        角色的统一标准 I/O 接口
        :param user_prompt: 具体的任务输入 (Human Message)
        :param response_format: 期望的输出格式 (默认 json)
        """
        # 可以在这里做全局的日志埋点、Token 统计等
        print(f"     🧠 [{self.name}] 正在思考与推演...")

        try:
            if response_format == "json":
                return self.llm.generate_json(user_prompt, self.system_prompt)
            else:
                # 预留支持纯文本输出的接口
                return self.llm.generate_text(user_prompt, self.system_prompt)
        except Exception as e:
            print(f"     ⚠️ [{self.name}] 认知链路中断: {e}")
            raise e

    def update_system_prompt(self, new_prompt: str):
        """支持在运行时动态修改人格设定"""
        self.system_prompt = new_prompt
