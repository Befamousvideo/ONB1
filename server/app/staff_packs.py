"""Red O staff interview packs — Diggler/Vince v1.2 source of truth.

Loads docs/staff-packs/ONB1-RedO-Employee-Interview-Map-v1.2.json and walks
role trees for mode=staff. Prospect / exploring stays on the linear machine.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException

PACK_FILENAME = "ONB1-RedO-Employee-Interview-Map-v1.2.json"
DEFAULT_CLIENT_ID = "red-o"
DEFAULT_INVOICE_ID = "202609-22-RED-111"
EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")

SOFT_OPTIONAL_ROLES = frozenset({"staff_foh", "staff_boh"})
HQ_PHONE_ROLES = frozenset(
    {"staff_ceo", "staff_hr", "staff_sales", "staff_finance", "staff_admin", "staff_other"}
)
EXEC_ONLY_ROLES = frozenset({"staff_ceo"})
MONEY_VISIBLE = frozenset({"Yes — place and/or check", "I see them but don't own them"})
THIN_EVIDENCE_LABELS = frozenset({"skip", "not sure"})
STRUCTURED_FIELD_KEYS = frozenset(
    {
        "pack_answers",
        "nora_export",
        "pack_history",
        "software_stack_products",
        "product_names",
    }
)

FIELD_ALIASES = {
    "name": "full_name",
    "workPhone": "work_phone",
    "work_phone": "work_phone",
    "phone": "work_phone",
    "clientInvoiceId": "client_invoice_id",
    "client_invoice_id": "client_invoice_id",
    "clientId": "client_id",
    "invoiceId": "invoice_id",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def pack_json_path() -> Path:
    return _repo_root() / "docs" / "staff-packs" / PACK_FILENAME


@lru_cache(maxsize=1)
def load_pack_document() -> dict[str, Any]:
    path = pack_json_path()
    if not path.is_file():
        raise FileNotFoundError(f"staff pack SoT missing: {path}")
    with path.open(encoding="utf-8") as handle:
        data = json.loads(handle.read())
    if str(data.get("version", "")).split(".")[0] != "1":
        raise ValueError("unexpected staff pack major version")
    if data.get("version") != "1.2.0":
        raise ValueError(f"PR3 encodes v1.2.0 only, got {data.get('version')}")
    return data


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def parse_json_field(value: Any, default: Any = None) -> Any:
    if default is None:
        default = {}
    if isinstance(value, (dict, list)):
        return value
    text = clean_text(value)
    if not text:
        return default
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return default
    return parsed if isinstance(parsed, type(default)) or isinstance(parsed, (dict, list)) else default


def dump_json_field(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def split_multi(value: Any) -> list[str]:
    if isinstance(value, list):
        return [clean_text(item) for item in value if clean_text(item)]
    text = clean_text(value)
    if not text:
        return []
    if text.startswith("["):
        parsed = parse_json_field(text, [])
        if isinstance(parsed, list):
            return [clean_text(item) for item in parsed if clean_text(item)]
    return [part.strip() for part in text.split(",") if part.strip()]


def option_value(option: Any) -> str:
    if isinstance(option, dict):
        return clean_text(option.get("value") or option.get("label"))
    return clean_text(option)


def option_label(option: Any) -> str:
    if isinstance(option, dict):
        return clean_text(option.get("label") or option.get("value"))
    return clean_text(option)


def public_options(options: list[Any] | None) -> list[dict[str, Any]]:
    published: list[dict[str, Any]] = []
    for option in options or []:
        if isinstance(option, dict):
            item = dict(option)
            item["value"] = option_value(option)
            item["label"] = option_label(option)
            published.append(item)
        else:
            text = clean_text(option)
            published.append({"value": text, "label": text})
    return published


def pack_document() -> dict[str, Any]:
    return load_pack_document()


def nodes_by_id() -> dict[str, dict[str, Any]]:
    return {node["id"]: node for node in pack_document()["nodes"]}


def get_node(node_id: str) -> dict[str, Any]:
    node = nodes_by_id().get(node_id)
    if not node:
        raise HTTPException(status_code=400, detail={"error": "unknown_pack_node", "node": node_id})
    return node


def role_branches() -> dict[str, dict[str, Any]]:
    return pack_document()["roleBranches"]


def invite_policy() -> dict[str, Any]:
    return pack_document()["invitePolicy"]


def quote_policy() -> dict[str, Any]:
    return pack_document()["quotePolicy"]


def staff_link_policy() -> dict[str, Any]:
    return pack_document()["staffLinkPolicy"]


def vince_locations() -> list[str]:
    keep = (
        pack_document()
        .get("packPayload", {})
        .get("red-o", {})
        .get("locationLock", {})
        .get("keep")
        or ["Fashion Island", "Santa Monica", "Westlake", "Irvine HQ", "Other"]
    )
    return list(keep)


def q3_location_options() -> list[str]:
    node = get_node("Q3")
    return [option_label(option) for option in node.get("options") or []]


def encode_all_roles() -> list[str]:
    policy = invite_policy()
    roles = list(policy.get("encodeAllRoles") or [])
    for extra in policy.get("encodeAlso") or []:
        if extra not in roles:
            roles.append(extra)
    return roles


def role_label(role_id: str) -> str:
    branch = role_branches().get(role_id) or {}
    return clean_text(branch.get("label")) or role_id


def canonical_staff_role(raw: str | None) -> str:
    text = clean_text(raw)
    if not text:
        return ""
    if text in role_branches():
        return text
    lowered = text.lower()
    aliases = {
        "owner / ceo / leadership": "staff_ceo",
        "owner / ceo": "staff_ceo",
        "owner/ceo": "staff_ceo",
        "ceo": "staff_ceo",
        "hr / people": "staff_hr",
        "hr/people": "staff_hr",
        "hr": "staff_hr",
        "sales": "staff_sales",
        "finance": "staff_finance",
        "admin / ops": "staff_admin",
        "admin/ops": "staff_admin",
        "admin": "staff_admin",
        "ops": "staff_admin",
        "front of house": "staff_foh",
        "foh": "staff_foh",
        "back of house / ops floor": "staff_boh",
        "back of house": "staff_boh",
        "boh": "staff_boh",
        "other / several seats": "staff_other",
        "other": "staff_other",
    }
    return aliases.get(lowered, "")


def is_exec_invite(fields: dict[str, str]) -> bool:
    invite = clean_text(fields.get("invite") or fields.get("invite_kind")).lower()
    return invite in {"exec", "exec-only", "execonly", "staff_ceo"}


def session_staff_role(fields: dict[str, str]) -> str:
    return canonical_staff_role(fields.get("staff_role") or fields.get("role") or fields.get("pack"))


def work_phone_required(role: str) -> bool:
    role_id = canonical_staff_role(role)
    if not role_id:
        return False
    if role_id in SOFT_OPTIONAL_ROLES:
        return False
    return role_id in HQ_PHONE_ROLES


def work_phone_soft_optional(role: str) -> bool:
    return canonical_staff_role(role) in SOFT_OPTIONAL_ROLES


def pack_answers(fields: dict[str, str]) -> dict[str, Any]:
    answers = parse_json_field(fields.get("pack_answers"), {})
    return answers if isinstance(answers, dict) else {}


def nora_export(fields: dict[str, str]) -> dict[str, Any]:
    export = parse_json_field(fields.get("nora_export"), {})
    if not isinstance(export, dict):
        export = {}
    export.setdefault("staff_quotes", [])
    export.setdefault("guest_friction", [])
    export.setdefault("software_stack", [])
    export.setdefault("time_sinks", [])
    export.setdefault("leak_hints", [])
    export.setdefault("one_fix_wish", [])
    export.setdefault("thin_evidence", [])
    export.setdefault("anonymity", fields.get("anonymity") or quote_policy().get("default") or "named")
    return export


def session_answer(fields: dict[str, str], node_id: str) -> str:
    answers = pack_answers(fields)
    raw = answers.get(node_id, fields.get(node_id, ""))
    if isinstance(raw, list):
        return ", ".join(clean_text(item) for item in raw if clean_text(item))
    return clean_text(raw)


def condition_matches(cond: str | None, fields: dict[str, str], answer: str) -> bool:
    if not cond or cond == "always":
        return True
    if cond == "else":
        return False
    if cond == "packResolved":
        return bool(clean_text(fields.get("pack_id") or fields.get("client_id") or fields.get("client_invoice_id")))
    if cond == "checked":
        return bool(split_multi(answer))
    if cond == "moneyVisible":
        return session_answer(fields, "FIN-G1") in MONEY_VISIBLE
    if cond.startswith("optionIncludes:"):
        needle = cond.split(":", 1)[1]
        return needle in split_multi(answer)
    if cond.startswith("session.role=="):
        return session_staff_role(fields) == cond.split("==", 1)[1]
    if "==" in cond:
        node_id, expected = cond.split("==", 1)
        return session_answer(fields, node_id) == expected
    selected = split_multi(answer)
    return answer == cond or cond in selected


def show_if_met(node: dict[str, Any], fields: dict[str, str]) -> bool:
    rule = node.get("showIf")
    if not rule:
        return True
    if isinstance(rule, dict):
        source = clean_text(rule.get("node"))
        needles = rule.get("optionIncludesAny") or []
        selected = split_multi(session_answer(fields, source))
        return any(item in selected for item in needles)
    text = clean_text(rule)
    if text.endswith(" money-visible"):
        source = text.split(" ", 1)[0]
        return session_answer(fields, source) in MONEY_VISIBLE
    if text.endswith(" checked"):
        source = text.split(" ", 1)[0]
        return bool(split_multi(session_answer(fields, source)))
    if "==" in text:
        source, expected = text.split("==", 1)
        return session_answer(fields, source) == expected
    return True


def resolve_next_node(node: dict[str, Any], fields: dict[str, str], answer: str) -> str:
    fallback = ""
    chosen = ""
    for edge in node.get("next") or []:
        cond = clean_text(edge.get("if"))
        target = clean_text(edge.get("then"))
        if cond == "else":
            fallback = target
            continue
        if condition_matches(cond, fields, answer):
            chosen = target
            enter = clean_text(edge.get("enterPack"))
            if enter:
                fields["staff_role"] = enter
                fields["role"] = role_label(enter)
            for key, value in (edge.get("set") or {}).items():
                if key == "packId":
                    fields["pack_id"] = clean_text(value)
                else:
                    fields[str(key)] = clean_text(value)
            break
    nxt = chosen or fallback
    if nxt == "LOOP_PREV":
        history = parse_json_field(fields.get("pack_history"), [])
        if isinstance(history, list) and len(history) >= 2:
            return clean_text(history[-2])
        return clean_text(fields.get("pack_node") or "Q4c")
    if nxt == "Q4" and (is_exec_invite(fields) or session_staff_role(fields)):
        return "Q4c"
    return nxt


def skip_hidden(node_id: str, fields: dict[str, str]) -> str:
    seen: set[str] = set()
    current = node_id
    while current and current not in seen:
        seen.add(current)
        if current in {"T_OK", "T_SOFT", "T_DEAD", "SUBMIT"}:
            return current
        node = get_node(current)
        if show_if_met(node, fields):
            return current
        current = resolve_next_node(node, fields, session_answer(fields, current))
    return node_id


def parse_client_invoice(raw: str) -> tuple[str, str]:
    text = clean_text(raw)
    if not text:
        return "", ""
    for sep in ("/", ":", "|"):
        if sep in text:
            left, right = text.split(sep, 1)
            return clean_text(left), clean_text(right)
    if text.lower() in {"red-o", "red_o", "redo"}:
        return "red-o", ""
    return "", text


def resolve_staff_link(payload: dict[str, Any] | None = None, fields: dict[str, str] | None = None) -> dict[str, str]:
    payload = payload or {}
    fields = fields or {}
    client = clean_text(
        payload.get("client_id")
        or payload.get("clientId")
        or payload.get("c")
        or payload.get("slug")
        or fields.get("client_id")
        or fields.get("c")
        or fields.get("slug")
    )
    invoice = clean_text(
        payload.get("invoice_id")
        or payload.get("invoiceId")
        or fields.get("invoice_id")
    )
    combined = clean_text(
        payload.get("client_invoice_id")
        or payload.get("clientInvoiceId")
        or fields.get("client_invoice_id")
    )
    parsed_client, parsed_invoice = parse_client_invoice(combined)
    if not client:
        client = parsed_client
    if not invoice:
        invoice = parsed_invoice
    if not client:
        client = DEFAULT_CLIENT_ID
    if not invoice:
        invoice = DEFAULT_INVOICE_ID
    if client.lower() in {"red-o", "red_o", "redo", "red o"}:
        client = DEFAULT_CLIENT_ID
    client_invoice_id = f"{client}/{invoice}"
    return {
        "client_id": client,
        "invoice_id": invoice,
        "client_invoice_id": client_invoice_id,
        "pack_id": "red-o" if client == DEFAULT_CLIENT_ID else clean_text(fields.get("pack_id") or "generic"),
        "company": "Red O" if client == DEFAULT_CLIENT_ID else clean_text(fields.get("company") or fields.get("business_name")),
    }


def staff_link_url(fields: dict[str, str], extra: dict[str, str] | None = None) -> str:
    params = {
        "mode": "staff",
        "client": fields.get("client_id") or DEFAULT_CLIENT_ID,
        "invoice": fields.get("invoice_id") or DEFAULT_INVOICE_ID,
        "clientInvoiceId": fields.get("client_invoice_id")
        or f"{fields.get('client_id') or DEFAULT_CLIENT_ID}/{fields.get('invoice_id') or DEFAULT_INVOICE_ID}",
    }
    if is_exec_invite(fields):
        params["invite"] = "exec"
    role = session_staff_role(fields)
    if role and role not in EXEC_ONLY_ROLES:
        params["pack"] = role
    if extra:
        params.update({key: value for key, value in extra.items() if value})
    query = "&".join(f"{key}={value}" for key, value in params.items() if value)
    return f"/?{query}"


def start_staff_session(payload: dict[str, Any] | None = None) -> dict[str, str]:
    payload = payload or {}
    fields = resolve_staff_link(payload)
    fields["mode"] = "staff"
    fields["anonymity"] = quote_policy().get("default") or "named"
    invite = clean_text(payload.get("invite") or payload.get("invite_kind")).lower()
    requested_pack = canonical_staff_role(payload.get("pack") or payload.get("role"))
    if invite in {"exec", "exec-only", "execonly"} or requested_pack == "staff_ceo":
        if requested_pack and requested_pack != "staff_ceo":
            raise HTTPException(status_code=400, detail={"error": "exec_invite_ceo_only"})
        fields["invite"] = "exec"
        fields["invite_kind"] = "exec"
        fields["staff_role"] = "staff_ceo"
        fields["role"] = role_label("staff_ceo")
        fields["pack"] = "staff_ceo"
    else:
        fields["invite"] = "general"
        fields["invite_kind"] = "general"
        if requested_pack == "staff_ceo":
            raise HTTPException(status_code=400, detail={"error": "staff_ceo_exec_only"})
        if requested_pack:
            fields["staff_role"] = requested_pack
            fields["role"] = role_label(requested_pack)
            fields["pack"] = requested_pack
    fields["business_name"] = fields.get("company") or "Red O"
    fields["do_not_send"] = "true" if invite_policy().get("doNotSend") else "false"
    return fields


def start_node_id(fields: dict[str, str]) -> str:
    if clean_text(fields.get("pack_id") or fields.get("client_id")):
        return "Q1"
    return "Q0b"


def is_pack_state(state: str) -> bool:
    return state in nodes_by_id() or state in {"T_OK", "T_SOFT", "T_DEAD"}


def terminal_state(node_id: str) -> str:
    if node_id == "T_OK":
        return "SUBMIT"
    return node_id


def q4_options_for_invite(fields: dict[str, str]) -> list[dict[str, Any]]:
    options = public_options(get_node("Q4").get("options"))
    if is_exec_invite(fields):
        return [option for option in options if option["value"] == "staff_ceo"]
    return [option for option in options if option["value"] not in EXEC_ONLY_ROLES]


def public_node(node_id: str, fields: dict[str, str]) -> dict[str, Any]:
    if node_id == "SUBMIT":
        node_id = "T_OK"
    node = get_node(node_id) if node_id in nodes_by_id() else {
        "id": node_id,
        "type": "terminal",
        "prompt": pack_document()["terminals"].get(node_id, ""),
        "required": False,
    }
    options = public_options(node.get("options"))
    if node_id == "Q4":
        options = q4_options_for_invite(fields)
    published = {
        "id": node.get("id", node_id),
        "type": node.get("type"),
        "prompt": node.get("prompt", ""),
        "required": bool(node.get("required")),
        "requiredMode": node.get("requiredMode"),
        "options": options,
        "fields": node.get("fields") or [],
        "softEscape": node.get("softEscape"),
        "productNameFollowUp": node.get("productNameFollowUp"),
        "phoneRule": node.get("phoneRule"),
        "pack": node.get("pack") or session_staff_role(fields),
        "noraFields": node.get("noraFields") or [],
        "quotePolicy": node.get("quotePolicy") or quote_policy(),
        "defaultAnonymity": quote_policy().get("default") or "named",
        "workPhoneRequired": work_phone_required(session_staff_role(fields)),
        "workPhoneSoftOptional": work_phone_soft_optional(session_staff_role(fields))
        or not session_staff_role(fields),
    }
    return published


def catalog() -> dict[str, Any]:
    doc = pack_document()
    policy = invite_policy()
    packs = []
    for role_id in encode_all_roles():
        branch = role_branches()[role_id]
        packs.append(
            {
                "id": role_id,
                "label": branch.get("label"),
                "lens": branch.get("lens"),
                "entryNode": branch.get("entryNode"),
                "nodeIds": branch.get("nodeIds") or [],
                "invitePath": "execOnly" if role_id in EXEC_ONLY_ROLES else "general",
                "onAllStaffLinks": role_id not in EXEC_ONLY_ROLES,
                "softLaunch": role_id in set(policy.get("softLaunchRoles") or []),
                "softLaunchLater": role_id in set(policy.get("softLaunchLater") or []),
            }
        )
    return {
        "version": doc.get("version"),
        "mode": "staff",
        "clientPackId": doc.get("clientPackId"),
        "surface": doc.get("surface"),
        "locations": q3_location_options(),
        "locationLock": vince_locations(),
        "packs": packs,
        "invitePolicy": policy,
        "quotePolicy": quote_policy(),
        "staffLinkPolicy": staff_link_policy(),
        "vinceLocks": doc.get("vinceLocks"),
        "exportContract": doc.get("exportContract"),
        "doNotSend": bool(policy.get("doNotSend")),
        "exampleLink": {
            "client": DEFAULT_CLIENT_ID,
            "invoice": DEFAULT_INVOICE_ID,
            "clientInvoiceId": f"{DEFAULT_CLIENT_ID}/{DEFAULT_INVOICE_ID}",
            "url": f"/?mode=staff&client={DEFAULT_CLIENT_ID}&invoice={DEFAULT_INVOICE_ID}&clientInvoiceId={DEFAULT_CLIENT_ID}/{DEFAULT_INVOICE_ID}",
            "execUrl": f"/?mode=staff&invite=exec&client={DEFAULT_CLIENT_ID}&invoice={DEFAULT_INVOICE_ID}&clientInvoiceId={DEFAULT_CLIENT_ID}/{DEFAULT_INVOICE_ID}",
        },
        "shipOrder": doc.get("shipOrder"),
    }


def pack_detail(role_id: str) -> dict[str, Any]:
    role = canonical_staff_role(role_id)
    if role not in role_branches():
        raise HTTPException(status_code=404, detail="staff_pack_not_found")
    branch = role_branches()[role]
    node_ids = ["Q0", "Q0b", "Q1", "Q2", "Q3", "Q3o", "Q4", "Q4c", *branch.get("nodeIds", []), "QS", "T_OK"]
    return {
        "id": role,
        "label": branch.get("label"),
        "lens": branch.get("lens"),
        "entryNode": branch.get("entryNode"),
        "invitePath": "execOnly" if role in EXEC_ONLY_ROLES else "general",
        "nodes": [public_node(node_id, {"staff_role": role, "invite": "exec" if role in EXEC_ONLY_ROLES else "general"}) for node_id in node_ids if node_id in nodes_by_id()],
    }


def _answer_from_payload(node: dict[str, Any], incoming: dict[str, Any], content: str) -> str:
    node_type = clean_text(node.get("type"))
    if node_type == "contact":
        name = clean_text(incoming.get("full_name") or incoming.get("name"))
        email = clean_text(incoming.get("email"))
        phone = clean_text(incoming.get("work_phone") or incoming.get("workPhone") or incoming.get("phone"))
        return " | ".join(part for part in (name, email, phone) if part)
    if node_type in {"checkboxes", "checkbox"}:
        raw = incoming.get("answer") or incoming.get("options") or incoming.get(node["id"])
        if raw is None:
            raw = content
        return ", ".join(split_multi(raw))
    if node.get("id") == "Q4":
        return canonical_staff_role(incoming.get("staff_role") or incoming.get("role") or incoming.get("answer") or content)
    if node.get("id") == "Q4c":
        raw = clean_text(incoming.get("anonymity") or incoming.get("answer") or content)
        if raw in {"named", "anonymous_keep_role", "prefer_not"}:
            return raw
        lowered = raw.lower()
        if "role + location only" in lowered or lowered == "anonymous_keep_role":
            return "anonymous_keep_role"
        if "prefer not" in lowered:
            return "prefer_not"
        if raw:
            return "named"
        return quote_policy().get("default") or "named"
    return clean_text(incoming.get("answer") or incoming.get(node["id"]) or content)


def _validate_product_names(node: dict[str, Any], incoming: dict[str, Any], selected: list[str]) -> dict[str, str]:
    follow = node.get("productNameFollowUp")
    if not follow:
        return {}
    skip = set(follow.get("skipForOptions") or ["Prefer not to say"])
    other_matches = set((follow.get("otherRule") or {}).get("optionMatches") or ["Other", "Other (type exact name)"])
    raw_names = incoming.get("product_names") or incoming.get("productNames") or incoming.get("software_stack_products")
    names = parse_json_field(raw_names, {})
    if not isinstance(names, dict):
        names = {}
    cleaned = {clean_text(key): clean_text(value) for key, value in names.items() if clean_text(key)}
    meaningful = [item for item in selected if item not in skip]
    if not meaningful:
        return cleaned
    for category in meaningful:
        if category in other_matches and not cleaned.get(category):
            raise HTTPException(
                status_code=400,
                detail={"error": "product_name_required", "fields": ["productName"], "category": category},
            )
        if category not in other_matches and not cleaned.get(category):
            raise HTTPException(
                status_code=400,
                detail={"error": "product_name_required", "fields": ["productName"], "category": category},
            )
    return cleaned


def validate_staff_node(node: dict[str, Any], fields: dict[str, str], incoming: dict[str, Any], content: str) -> str:
    node_id = node["id"]
    node_type = clean_text(node.get("type"))
    answer = _answer_from_payload(node, incoming, content)
    required = bool(node.get("required"))
    soft = clean_text(node.get("requiredMode")) == "soft" or bool(node.get("softEscape"))

    if node_type == "contact":
        name = clean_text(incoming.get("full_name") or incoming.get("name") or fields.get("full_name"))
        email = clean_text(incoming.get("email") or fields.get("email"))
        phone = clean_text(
            incoming.get("work_phone")
            or incoming.get("workPhone")
            or incoming.get("phone")
            or fields.get("work_phone")
        )
        missing: list[str] = []
        if not name:
            missing.append("full_name")
        if not email:
            missing.append("email")
        elif not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail={"error": "invalid_email"})
        role = session_staff_role(fields)
        if work_phone_required(role) and not phone:
            missing.append("work_phone")
        if missing:
            raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": missing})
        return answer

    if node_id == "Q4":
        role = canonical_staff_role(answer)
        if not role:
            raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": ["role"]})
        if role in EXEC_ONLY_ROLES and not is_exec_invite(fields):
            raise HTTPException(status_code=400, detail={"error": "staff_ceo_exec_only"})
        return role

    if node_type in {"checkboxes", "checkbox", "mc"} and required and not split_multi(answer):
        raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": [node_id]})

    if node.get("productNameFollowUp"):
        _validate_product_names(node, incoming, split_multi(answer))

    if node_type in {"paragraph", "short"} and required and not soft and not answer:
        raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": [node_id]})

    if node_type == "cta" and required and not (answer or content):
        return option_label((node.get("options") or ["Begin discovery"])[0])

    return answer


def _append_unique(bucket: list[Any], item: Any) -> None:
    if item and item not in bucket:
        bucket.append(item)


def update_nora_export(fields: dict[str, str], node: dict[str, Any], answer: str, product_names: dict[str, str]) -> dict[str, Any]:
    export = nora_export(fields)
    node_id = node["id"]
    nora_fields = set(node.get("noraFields") or [])
    role = session_staff_role(fields)
    location = clean_text(fields.get("company_location") or fields.get("location") or session_answer(fields, "Q3"))
    anonymity = clean_text(fields.get("anonymity") or quote_policy().get("default") or "named")
    thin = answer.lower() in THIN_EVIDENCE_LABELS or not answer

    if "staff_quotes" in nora_fields and node.get("type") == "paragraph":
        quotes = [item for item in export.get("staff_quotes") or [] if item.get("node_id") != node_id]
        if thin:
            _append_unique(export.setdefault("thin_evidence", []), node_id)
        else:
            quotes.append(
                {
                    "speaker_role": role or "staff_admin",
                    "quote_text": answer,
                    "location": location,
                    "anonymity": anonymity,
                    "node_id": node_id,
                    "lens": role or "staff_admin",
                }
            )
        export["staff_quotes"] = quotes

    if "guest_friction" in nora_fields:
        guest_options = node.get("guestFrictionOptions") or []
        selected = split_multi(answer)
        if guest_options:
            if any(option in selected for option in guest_options):
                _append_unique(export.setdefault("guest_friction", []), {"node_id": node_id, "value": answer})
        elif answer and not thin:
            _append_unique(export.setdefault("guest_friction", []), {"node_id": node_id, "value": answer})

    if "software_stack" in nora_fields or product_names:
        stack = [item for item in export.get("software_stack") or [] if item.get("node_id") != node_id]
        for category in split_multi(answer):
            if category == "Prefer not to say":
                continue
            stack.append(
                {
                    "category": category,
                    "productName": product_names.get(category, ""),
                    "node_id": node_id,
                    "lens": role,
                }
            )
        export["software_stack"] = stack

    if "time_sinks" in nora_fields and answer and not thin:
        _append_unique(export.setdefault("time_sinks", []), {"node_id": node_id, "value": answer, "lens": role})
    if "leak_hints" in nora_fields and answer and not thin:
        _append_unique(export.setdefault("leak_hints", []), {"node_id": node_id, "value": answer, "lens": role})
    if "one_fix_wish" in nora_fields and answer and not thin:
        export["one_fix_wish"] = [{"node_id": node_id, "value": answer, "lens": role}]
    if "locations" in nora_fields and answer:
        export["locations"] = answer
    if "anonymity" in nora_fields:
        export["anonymity"] = answer or anonymity
        export["anonymous_keeps_role"] = answer == "anonymous_keep_role"
    if "company" in nora_fields and answer:
        export["company"] = fields.get("company") or fields.get("business_name") or answer
    export["client_invoice_id"] = fields.get("client_invoice_id")
    export["speaker_role"] = role
    export["location"] = location
    fields["nora_export"] = dump_json_field(export)
    return export


def apply_staff_step(
    state: str,
    fields: dict[str, str],
    incoming: dict[str, Any],
    content: str = "",
) -> tuple[str, dict[str, str]]:
    if state == "SUBMIT":
        return "SUBMIT", fields
    if state == "Q0":
        state = start_node_id(fields)

    node = get_node(state)
    incoming_text = {key: clean_text(value) if not isinstance(value, (dict, list)) else value for key, value in incoming.items()}
    for src, dest in FIELD_ALIASES.items():
        if incoming_text.get(src) and not incoming_text.get(dest):
            incoming_text[dest] = incoming_text[src]

    answer = validate_staff_node(node, fields, incoming_text, content)
    answers = pack_answers(fields)
    answers[state] = answer
    fields["pack_answers"] = dump_json_field(answers)

    if node.get("type") == "contact":
        fields["full_name"] = clean_text(incoming_text.get("full_name") or incoming_text.get("name") or fields.get("full_name"))
        fields["email"] = clean_text(incoming_text.get("email") or fields.get("email"))
        phone = clean_text(incoming_text.get("work_phone") or incoming_text.get("workPhone") or incoming_text.get("phone"))
        if phone:
            fields["work_phone"] = phone
    if state == "Q3":
        fields["company_location"] = answer
        fields["location"] = answer
    if state == "Q3o" and answer:
        fields["company_location"] = answer
        fields["location"] = answer
    if state == "Q4":
        fields["staff_role"] = answer
        fields["role"] = role_label(answer)
        fields["pack"] = answer
        if work_phone_required(answer) and not clean_text(fields.get("work_phone")):
            raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": ["work_phone"]})
    if state == "Q4c":
        fields["anonymity"] = answer or (quote_policy().get("default") or "named")
        fields["quote_anonymity"] = fields["anonymity"]
    if state == "Q0b":
        if answer == "Red O Restaurants":
            fields["pack_id"] = "red-o"
            fields["company"] = "Red O"
            fields["business_name"] = "Red O"
        else:
            fields["pack_id"] = fields.get("pack_id") or "generic"
            fields["company"] = answer
            fields["business_name"] = answer

    product_names = {}
    if node.get("productNameFollowUp"):
        product_names = _validate_product_names(node, incoming_text, split_multi(answer))
        fields["software_stack_products"] = dump_json_field(product_names)
        fields["productName"] = "; ".join(f"{key}: {value}" for key, value in product_names.items() if value)

    if node.get("type") == "paragraph" and answer.lower() in THIN_EVIDENCE_LABELS:
        fields["thin_evidence"] = "true"

    update_nora_export(fields, node, answer, product_names)

    history = parse_json_field(fields.get("pack_history"), [])
    if not isinstance(history, list):
        history = []
    if not history or history[-1] != state:
        history.append(state)
    fields["pack_history"] = dump_json_field(history)

    nxt = resolve_next_node(node, fields, answer)
    nxt = skip_hidden(nxt, fields) if nxt else "QS"
    if nxt == "T_OK":
        fields["pack_node"] = "T_OK"
        return "SUBMIT", fields
    fields["pack_node"] = nxt
    return nxt, fields


def ensure_staff_submit_identity(fields: dict[str, str]) -> None:
    role = session_staff_role(fields)
    missing: list[str] = []
    if not clean_text(fields.get("full_name")):
        missing.append("full_name")
    if not clean_text(fields.get("email")):
        missing.append("email")
    elif not EMAIL_RE.match(clean_text(fields.get("email"))):
        raise HTTPException(status_code=400, detail={"error": "invalid_email"})
    phone = clean_text(fields.get("work_phone") or fields.get("phone"))
    if work_phone_required(role) and not phone:
        missing.append("work_phone")
    if phone:
        fields["work_phone"] = phone
    if not clean_text(fields.get("client_invoice_id")):
        link = resolve_staff_link(fields=fields)
        fields.update(link)
    if missing:
        raise HTTPException(status_code=400, detail={"error": "missing_fields", "fields": missing})


def staff_summary_lines(fields: dict[str, str]) -> list[str]:
    lines: list[str] = []
    if fields.get("full_name") and fields.get("anonymity") != "anonymous_keep_role":
        lines.append(f"Name: {fields['full_name']}")
    if fields.get("email"):
        lines.append(f"Email: {fields['email']}")
    if fields.get("work_phone"):
        lines.append(f"Work phone: {fields['work_phone']}")
    role = session_staff_role(fields)
    if role:
        lines.append(f"Seat: {role_label(role)}")
    if fields.get("company_location") or fields.get("location"):
        lines.append(f"Location: {fields.get('company_location') or fields.get('location')}")
    if fields.get("client_invoice_id"):
        lines.append(f"Client / invoice: {fields['client_invoice_id']}")
    if fields.get("anonymity"):
        lines.append(f"Quote label: {fields['anonymity']}")
    export = nora_export(fields)
    quotes = export.get("staff_quotes") or []
    if quotes:
        lines.append(f"Staff quotes captured: {len(quotes)}")
    stack = export.get("software_stack") or []
    if stack:
        names = [f"{item.get('category')}" + (f" ({item.get('productName')})" if item.get("productName") else "") for item in stack]
        lines.append(f"Systems: {', '.join(names)}")
    return lines
