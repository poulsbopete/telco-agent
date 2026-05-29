#!/usr/bin/env python3
"""Deploy inference endpoint, Agent Builder tools, and telco persona agents."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx
import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

INFERENCE_ID = os.getenv("INFERENCE_ID", "jina-embeddings-v3")
STATE_DIR = ROOT / "agents/state"


def kibana_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
        "x-elastic-internal-origin": "kibana",
        "Authorization": f"ApiKey {api_key}",
    }


def es_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"ApiKey {api_key}",
    }


def load_config() -> dict:
    with (ROOT / "agents/config.yaml").open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def ensure_inference(client: httpx.Client, es_url: str, es_key: str) -> None:
    body = {
        "service": "elastic",
        "service_settings": {
            "model_id": "jina-embeddings-v3",
            "dimensions": 1024,
            "max_input_tokens": 8192,
        },
    }
    resp = client.put(
        f"{es_url}/_inference/text_embedding/{INFERENCE_ID}",
        headers=es_headers(es_key),
        json=body,
    )
    if resp.status_code >= 300 and resp.status_code != 409:
        print(f"WARN inference: HTTP {resp.status_code} {resp.text[:200]}")


def deploy_tool(client: httpx.Client, kibana_url: str, kibana_key: str, tool_cfg: dict) -> bool:
    tool_id = tool_cfg["id"]
    body = {
        "id": tool_id,
        "type": tool_cfg["type"],
        "description": tool_cfg["description"].strip(),
        "configuration": {"pattern": tool_cfg["pattern"]},
    }
    client.delete(
        f"{kibana_url}/api/agent_builder/tools/{tool_id}",
        headers=kibana_headers(kibana_key),
    )
    resp = client.post(
        f"{kibana_url}/api/agent_builder/tools",
        headers=kibana_headers(kibana_key),
        json=body,
    )
    if resp.status_code >= 300:
        print(f"FAIL tool {tool_id}: HTTP {resp.status_code} {resp.text[:300]}", file=sys.stderr)
        return False
    print(f"OK tool {tool_id}")
    return True


def deploy_agent(
    client: httpx.Client,
    kibana_url: str,
    kibana_key: str,
    agent_id: str,
    name: str,
    description: str,
    instructions: str,
    tool_ids: list[str],
) -> str | None:
    body = {
        "id": agent_id,
        "name": name,
        "description": description,
        "configuration": {
            "instructions": instructions,
            "tools": [{"tool_ids": tool_ids}],
        },
    }
    client.delete(
        f"{kibana_url}/api/agent_builder/agents/{agent_id}",
        headers=kibana_headers(kibana_key),
    )
    resp = client.post(
        f"{kibana_url}/api/agent_builder/agents",
        headers=kibana_headers(kibana_key),
        json=body,
    )
    if resp.status_code >= 300:
        print(f"FAIL agent {agent_id}: HTTP {resp.status_code} {resp.text[:300]}", file=sys.stderr)
        return None

    deployed_id = agent_id
    verify = client.get(
        f"{kibana_url}/api/agent_builder/agents/{agent_id}",
        headers=kibana_headers(kibana_key),
    )
    if verify.status_code < 300:
        data = verify.json()
        deployed_id = data.get("id", agent_id)
        instr = data.get("configuration", {}).get("instructions", "")
        print(f"OK agent {agent_id} (instructions len={len(instr)})")
    else:
        print(f"OK agent {agent_id} (verify skipped)")
    return deployed_id


def deploy_all() -> dict:
    es_url = os.getenv("ES_URL", "").rstrip("/")
    es_key = os.getenv("ES_API_KEY", "").strip()
    kibana_url = os.getenv("KIBANA_BASE_URL", "").rstrip("/")
    kibana_key = os.getenv("KIBANA_API_KEY", "").strip()

    if not all([es_url, es_key, kibana_url, kibana_key]):
        print("ES_URL, ES_API_KEY, KIBANA_BASE_URL, and KIBANA_API_KEY are required.", file=sys.stderr)
        sys.exit(1)

    cfg = load_config()
    tool_cfg = cfg["tools"]["tmobile_kb_search"]
    carrier = cfg["carriers"]["tmobile"]
    personas_dir = ROOT / "agents/personas"

    state: dict = {"carriers": {}, "tools": []}
    tool_ids: list[str] = []

    with httpx.Client(timeout=120.0) as client:
        ensure_inference(client, es_url, es_key)
        if deploy_tool(client, kibana_url, kibana_key, tool_cfg):
            tool_ids.append(tool_cfg["id"])
            state["tools"].append(tool_cfg["id"])

        carrier_state: dict = {"roles": {}}
        for role_key, role in carrier["roles"].items():
            persona_path = personas_dir / role["persona_file"]
            instructions = persona_path.read_text(encoding="utf-8")
            agent_uuid = deploy_agent(
                client,
                kibana_url,
                kibana_key,
                role["agent_id"],
                f"T-Mobile {role['label']}",
                role["description"],
                instructions,
                tool_ids,
            )
            carrier_state["roles"][role_key] = {
                "agent_id": role["agent_id"],
                "deployed_id": agent_uuid,
                "label": role["label"],
            }
        state["carriers"]["tmobile"] = carrier_state

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_path = STATE_DIR / "agents.json"
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(f"Wrote {state_path}")
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy telco Agent Builder agents")
    parser.parse_args()
    deploy_all()


if __name__ == "__main__":
    main()
