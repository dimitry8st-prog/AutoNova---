from __future__ import annotations

from fastapi.testclient import TestClient

from autonova.api.main import create_app
from autonova.llm import MockLLMClient
from autonova.orchestrator import AIOrchestrator


def test_health_and_chat_flow(monkeypatch):
    app = create_app()
    # Ensure deterministic orchestrator
    import autonova.api.main as api_main

    api_main.get_orchestrator.cache_clear()
    orch = AIOrchestrator(llm=MockLLMClient())
    monkeypatch.setattr(api_main, "get_orchestrator", lambda: orch)

    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["skills"] == 12
    assert body["agents"] == ["SALES_AGENT", "SUPPORT_AGENT", "SERVICE_AGENT"]

    skills = client.get("/api/skills").json()
    assert len(skills["skills"]) == 12

    chat = client.post("/api/chat", json={"message": "Хочу купить кроссовер"})
    assert chat.status_code == 200
    data = chat.json()
    assert data["agent"] == "SALES_AGENT"
    assert data["session_id"]
    assert data["reply"]

    reset = client.post("/api/reset", json={"session_id": data["session_id"]})
    assert reset.status_code == 200
    assert reset.json()["active_agent"] is None

    tg = client.post(
        "/api/channels/telegram",
        json={"text": "Статус заказа АН-2024-0388", "chat_id": "tg-1"},
    )
    assert tg.status_code == 200
    assert tg.json()["agent"] == "SUPPORT_AGENT"
    assert tg.json()["channel"] == "telegram"
