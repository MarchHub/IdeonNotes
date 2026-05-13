import config
from core.llm_provider import get_llm_client
from workflows.phaseshard_builder import PhaseShardWorkflow


def main():
    print("🚀 Initializing PhaseShard Agent...")

    llm_client = get_llm_client(
        provider=config.LLM_PROVIDER,
        base_url=config.OLLAMA_BASE_URL,
        model=config.OLLAMA_MODEL,
    )

    # 实例化工作流
    workflow = PhaseShardWorkflow(llm=llm_client)

    workflow.run()


if __name__ == "__main__":
    main()
