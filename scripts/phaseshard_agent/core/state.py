from typing import Any, Dict, List

from pydantic import BaseModel, Field


class GraphState(BaseModel):
    """
    定义贯穿整个 Agent 工作流的状态容器
    状态机
    """

    files_to_process: List[str] = Field(default_factory=list)
    parsed_documents: Dict[str, Any] = Field(default_factory=dict)
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
