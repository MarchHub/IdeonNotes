import json
from pathlib import Path

import config
from core.llm_provider import BaseLLM
from core.role import BaseRole
from core.state import GraphState
from tools.md_parser import MarkdownParser


class PhaseShardWorkflow:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    def step_1_scan_files(self, state: GraphState) -> GraphState:
        """Node 1: 扫描全部 Markdown 笔记"""
        print("--> [Step 1] Scanning files...")
        target_dir = config.POSTS_DIR
        md_files = list(target_dir.rglob("*.md"))
        state.files_to_process = [str(f) for f in md_files if ".github" not in str(f)]
        return state

    def step_2_parse_and_extract(self, state: GraphState) -> GraphState:
        """Node 2: 提取基础元数据和显式链接 (Hard Links)"""
        print("--> [Step 2] Parsing Markdown and Hard Links...")
        for file_path in state.files_to_process:
            parsed_data = MarkdownParser.parse(Path(file_path))
            node_id = parsed_data["title"]

            # 推导所属组别 (根据目录结构)
            relative_parts = Path(file_path).relative_to(config.POSTS_DIR).parts
            group = relative_parts[0] if len(relative_parts) > 1 else "Root"

            state.parsed_documents[node_id] = parsed_data
            state.nodes.append(
                {
                    "id": node_id,
                    "title": node_id,
                    "group": group,
                    "val": 2,  # 基础权重
                    "path": f"/posts/{'/'.join(relative_parts)}".replace(
                        ".md", ".html"
                    ),
                }
            )

            # 建立显式连线
            for link in parsed_data["links"]:
                state.edges.append(
                    {
                        "source": node_id,
                        "target": link,
                        "type": "hard",
                        "reason": "显式双向链接",
                    }
                )
        return state

    def step_3_llm_semantic_analysis(self, state: GraphState) -> GraphState:
        """Node 3: 语义分析与拓扑属性生成 (通用角色装配架构)"""
        print("--> [Step 3] Assembling Roles and Running Semantic Analysis...")

        # 定义角色
        ACTOR_PROMPT = """
        你是一个知识图谱数据提取专家。
        请根据提供的内容，输出JSON：
        {
          "summary": "精简摘要（50字内，直接陈述结论，禁止废话）",
          "tags": ["精准技术标签1", "标签2", "标签3"]
        }
        """

        CRITIC_PROMPT = """
        你是一个严苛的系统架构审查员。
        审查提取的摘要和标签是否规范（摘要无口语化废话，标签不可泛泛而谈）。
        输出JSON：
        {
          "is_valid": true或false,
          "reason": "如果为false给严厉修改建议；true则填'pass'"
        }
        """

        actor = BaseRole(
            name="Data Actor", system_prompt=ACTOR_PROMPT, llm_client=self.llm
        )
        critic = BaseRole(
            name="Quality Critic", system_prompt=CRITIC_PROMPT, llm_client=self.llm
        )

        max_retries = 2

        for node in state.nodes:
            node_id = node["id"]
            doc_content = state.parsed_documents[node_id]["content"]

            print(f"\n  🔍 Indexing: {node_id}")

            attempts = 0
            feedback = ""
            final_result = {}

            while attempts <= max_retries:
                # 构造 Actor 的输入
                actor_input = f"标题: {node_id}\n内容: {doc_content}"
                if feedback:
                    actor_input += f"\n\n【Critic打回意见：{feedback}。请严格修正！】"

                try:
                    # 角色交互
                    actor_res = actor.execute(user_prompt=actor_input)

                    critic_input = f"标题: {node_id}\n摘要: {actor_res.get('summary')}\n标签: {actor_res.get('tags')}"
                    critic_res = critic.execute(user_prompt=critic_input)

                    if critic_res.get("is_valid"):
                        print(
                            f"     ✅ [Quality Critic] 验证通过: {critic_res.get('reason')}"
                        )
                        final_result = actor_res
                        break
                    else:
                        feedback = critic_res.get("reason", "标准不符")
                        print(f"     ❌ [Quality Critic] 拒绝: {feedback}")
                        attempts += 1
                        final_result = actor_res

                except Exception:
                    break

            # 保存结果
            node["summary"] = final_result.get("summary", "Metadata unavailable.")
            node["tags"] = final_result.get("tags", [])

        return state

    def step_4_build_soft_edges(self, state: GraphState) -> GraphState:
        """Node 4: 基于 LLM 提取的 Tags，自动计算 Soft Links"""
        print("--> [Step 4] Building Semantic Soft Links...")
        # 为了简单起见，这里采用共享 Tag 策略。如果两个节点有相同的 Tag，建立软链接。
        for i in range(len(state.nodes)):
            for j in range(i + 1, len(state.nodes)):
                node_a = state.nodes[i]
                node_b = state.nodes[j]

                shared_tags = set(node_a.get("tags", [])) & set(node_b.get("tags", []))
                if shared_tags:
                    # 增加权重
                    node_a["val"] += len(shared_tags)
                    node_b["val"] += len(shared_tags)

                    state.edges.append(
                        {
                            "source": node_a["id"],
                            "target": node_b["id"],
                            "type": "soft",
                            "reason": f"语义关联 (Shared: {', '.join(shared_tags)})",
                        }
                    )
        return state

    def step_5_export(self, state: GraphState) -> GraphState:
        """Node 5: 导出阶段"""
        print("--> [Step 5] Exporting to JSON...")
        config.OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

        export_data = {"nodes": state.nodes, "links": state.edges}

        with open(config.OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        print(
            f"✅ PhaseShard Knowledge Graph built successfully! Saved to {config.OUTPUT_JSON}"
        )
        return state

    def run(self):
        state = GraphState()
        # 顺序执行流转 State
        state = self.step_1_scan_files(state)
        state = self.step_2_parse_and_extract(state)
        state = self.step_3_llm_semantic_analysis(state)
        state = self.step_4_build_soft_edges(state)
        state = self.step_5_export(state)
