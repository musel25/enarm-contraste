"""Compile independently reviewed guideline-based clinical layers."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_full_decks import content_hash, planner_card, write_json

OBJECTIVES = {
    "ancla",
    "variante",
    "incompleta",
    "subtipo",
    "contraste",
    "cambio",
    "dato_faltante",
    "gravedad",
    "mecanismo",
}


def text(value):
    return isinstance(value, str) and bool(value.strip())


def normalized(value):
    value = unicodedata.normalize("NFKD", value).casefold()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def scenarios(section):
    return [case for block in section["blocks"] for case in block["scenarios"]]


def same_ids(value, expected):
    return (
        isinstance(value, list)
        and all(isinstance(item, str) for item in value)
        and len(value) == len(expected)
        and set(value) == expected
    )


def validate_section(section, review, expected):
    """Structural and coverage checks support, but never replace, source review."""
    if (
        not isinstance(section, dict)
        or type(section.get("schema_version")) is not int
        or section["schema_version"] != 1
    ):
        raise ValueError("Invalid layer schema")
    sid = section.get("section_id")
    if (
        sid != expected["id"]
        or type(section.get("layer")) is not int
        or section["layer"] not in (1, 2)
    ):
        raise ValueError("Invalid section identity")
    if not all(text(section.get(key)) for key in ("author", "title", "mexico_source_note")):
        raise ValueError(f"Missing author or national source note: {sid}")
    sources = section.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError(f"Missing sources: {sid}")
    source_ids = set()
    for source in sources:
        if not isinstance(source, dict) or not all(
            text(source.get(key))
            for key in ("id", "label", "url", "version", "locator", "checked_at")
        ):
            raise ValueError(f"Invalid source: {sid}")
        url = urlparse(source["url"])
        if (
            source["id"] in source_ids
            or source.get("access") != "checked"
            or source.get("region") not in ("mexico", "international")
            or url.scheme != "https"
            or not url.hostname
            or url.username
            or url.password
        ):
            raise ValueError(f"Invalid or unchecked source: {sid}")
        try:
            checked = date.fromisoformat(source["checked_at"])
            if checked > date.today():
                raise ValueError("Future source check")
        except (TypeError, ValueError) as error:
            raise ValueError(f"Invalid source check date: {sid}") from error
        source_ids.add(source["id"])
    if not any(s["region"] == "international" for s in sources):
        raise ValueError(f"Missing international source: {sid}")
    blocks = section.get("blocks")
    expected_blocks = {b["id"] for b in expected["blocks"]}
    if (
        not isinstance(blocks, list)
        or len(blocks) != len(expected_blocks)
        or {b.get("id") for b in blocks if isinstance(b, dict)} != expected_blocks
    ):
        raise ValueError(f"Block coverage mismatch: {sid}")
    expected_anchors = {t["id"] for b in expected["blocks"] for t in b["topics"]}
    seen_ids, seen_vignettes, covered = set(), set(), set()
    for block in blocks:
        if (
            not text(block.get("title"))
            or not isinstance(block.get("related_sections"), list)
            or not all(
                isinstance(s, str) and re.fullmatch(r"[0-9]{2}", s) and 1 <= int(s) <= 35
                for s in block["related_sections"]
            )
            or len(set(block["related_sections"])) != len(block["related_sections"])
            or not isinstance(block.get("scenarios"), list)
            or not block["scenarios"]
        ):
            raise ValueError(f"Invalid block: {sid}")
        if sid == "35" and section["layer"] == 1 and len(block["scenarios"]) < 2:
            raise ValueError("Electrolyte block coverage needs two scenarios")
        for case in block["scenarios"]:
            if not isinstance(case, dict) or not all(
                text(case.get(key))
                for key in (
                    "id",
                    "vignette",
                    "question",
                    "answer",
                    "discriminator",
                    "reason",
                    "initial_action",
                    "limits",
                )
            ):
                raise ValueError(f"Incomplete scenario: {block['id']}")
            if (
                not case["id"].startswith(f"{block['id']}-")
                or case["id"] in seen_ids
                or normalized(case["vignette"]) in seen_vignettes
                or not isinstance(case.get("objective"), str)
                or case["objective"] not in OBJECTIVES
                or case["discriminator"] not in case["vignette"]
            ):
                raise ValueError(f"Duplicate or invalid scenario: {case['id']}")
            if (
                "diagnostico" in normalized(case["question"])
                and not any(
                    word in normalized(case["question"])
                    for word in ("dato", "manejo", "accion", "prueba", "tratamiento")
                )
                and len(normalized(case["answer"])) > 10
                and normalized(case["answer"]) in normalized(case["vignette"])
            ):
                raise ValueError(f"Answer leaked on front: {case['id']}")
            anchors = case.get("anchor_topic_ids")
            if (
                not isinstance(anchors, list)
                or not anchors
                or not all(isinstance(a, str) and a in expected_anchors for a in anchors)
            ):
                raise ValueError(f"Invalid anchor coverage: {case['id']}")
            evidence = case.get("evidence")
            if (
                not isinstance(evidence, list)
                or not evidence
                or not all(
                    isinstance(e, dict)
                    and isinstance(e.get("source_id"), str)
                    and e.get("source_id") in source_ids
                    and text(e.get("locator"))
                    and text(e.get("support"))
                    for e in evidence
                )
            ):
                raise ValueError(f"Invalid evidence: {case['id']}")
            seen_ids.add(case["id"])
            seen_vignettes.add(normalized(case["vignette"]))
            covered.update(anchors)
    minimum = sum(len(b["topics"]) for b in expected["blocks"])
    if covered != expected_anchors or (section["layer"] == 2 and len(seen_ids) <= minimum):
        raise ValueError(f"Incomplete clinical coverage: {sid}")
    if (
        not isinstance(review, dict)
        or review.get("section_id") != sid
        or type(review.get("layer")) is not int
        or review.get("layer") != section["layer"]
        or review.get("author") != section["author"]
        or not text(review.get("reviewer"))
        or review["reviewer"] == section["author"]
        or review.get("status") != "approved"
        or review.get("professional_review") != "pending"
        or review.get("content_sha256") != content_hash(section)
        or review.get("issues") != []
        or not isinstance(review.get("notes"), list)
        or not review["notes"]
        or not all(text(n) for n in review["notes"])
        or not same_ids(review.get("source_ids_checked"), source_ids)
        or not same_ids(review.get("scenario_ids"), seen_ids)
    ):
        raise ValueError(f"Missing or stale independent review: {sid}")


def compile_section(section):
    source_map = {s["id"]: s for s in section["sources"]}
    cards = []
    for block in section["blocks"]:
        for case in block["scenarios"]:
            objective = case["objective"]
            refs = [
                {
                    "label": f"{source_map[e['source_id']]['label']} ({source_map[e['source_id']]['version']}) · {e['locator']}",
                    "url": source_map[e["source_id"]]["url"],
                }
                for e in case["evidence"]
            ]
            family = "eje" if objective == "contraste" else "madre"
            level = (
                0
                if family == "eje"
                else 4
                if objective in ("gravedad", "cambio", "dato_faltante")
                else 3
                if objective == "mecanismo"
                else 2
            )
            prefix = "capa2/" if section["layer"] == 2 else ""
            cards.append(
                {
                    "id": f"{prefix}{family}/{case['id']}",
                    "family": family,
                    "level": level,
                    "section_id": section["section_id"],
                    "block_id": block["id"],
                    "topic_id": case["anchor_topic_ids"][0],
                    "objective": objective,
                    "related_sections": block["related_sections"],
                    "corrections": [section["mexico_source_note"]],
                    "prompt": case["question"],
                    "context": "",
                    "front": [{"text": case["vignette"], "highlight": case["discriminator"]}],
                    "back": [
                        {
                            "title": case["answer"],
                            "text": case["reason"],
                            "discriminator": case["discriminator"],
                            "action": case["initial_action"],
                            "limits": case["limits"],
                            "sources": refs,
                        }
                    ],
                    "sources": refs,
                }
            )
    return {
        "id": section["section_id"],
        "title": section["title"],
        "blocks": [
            {
                "id": b["id"],
                "title": b["title"],
                "topics": len(b["scenarios"]),
                "related_sections": b["related_sections"],
            }
            for b in section["blocks"]
        ],
        "cards": cards,
    }


def manifest_for(compiled, hashes, layer):
    cards = [card for s in compiled for card in s["cards"]]
    counts = Counter(card["family"] for card in cards)
    return {
        "schema_version": 1,
        "layer": layer,
        "content_sha256": content_hash(hashes),
        "review_status": "cross-reviewed",
        "professional_review": "pending",
        "counts": {
            "sections": len(compiled),
            "blocks": sum(len(s["blocks"]) for s in compiled),
            "cards": len(cards),
            "topic_occurrences": len(cards),
            "eje": counts["eje"],
            "madre": counts["madre"],
        },
        "sections": [
            {
                "id": s["id"],
                "title": s["title"],
                "blocks": len(s["blocks"]),
                "cards": len(s["cards"]),
                "url": f"sections/{s['id']}.json",
            }
            for s in compiled
        ],
        "downloads": [],
    }


def write_index(root, manifest, cards):
    index = {
        "schema_version": 1,
        "content_sha256": manifest["content_sha256"],
        "cards": [
            (
                (
                    planner_card(card, i)
                    | ({"objective": card["objective"]} if "objective" in card else {})
                )
                if "front" in card
                else {**card, "order": i}
            )
            for i, card in enumerate(cards)
        ],
    }
    write_json(root / "index.json", index)
    manifest["planner"] = {
        "url": "index.json",
        "cards": len(cards),
        "sha256": hashlib.sha256((root / "index.json").read_bytes()).hexdigest(),
    }
    write_json(root / "manifest.json", manifest)


def build_layers(source, output, catalog):
    authored = json.loads((source / "capa1/35.json").read_text())
    if authored.get("layer") != 1:
        raise ValueError("Layer 1 supplement identity required")
    expected35 = {
        "id": "35",
        "blocks": [
            {
                "id": b["id"],
                "topics": [
                    {"id": a}
                    for a in sorted({a for c in b["scenarios"] for a in c["anchor_topic_ids"]})
                ],
            }
            for b in authored["blocks"]
        ],
    }
    if {b["id"] for b in expected35["blocks"]} != {f"35.{n:02}" for n in range(1, 11)}:
        raise ValueError("Electrolyte coverage needs all ten blocks")
    required = [*catalog["sections"], expected35]
    compiled2, hashes = [], {}
    # Validate all authoring before changing any generated file.
    review1 = json.loads((source / "reviews/capa1/35.json").read_text())
    validate_section(authored, review1, expected35)
    for expected in required:
        section = json.loads((source / f"capa2/{expected['id']}.json").read_text())
        review = json.loads((source / f"reviews/capa2/{expected['id']}.json").read_text())
        if section["layer"] != 2:
            raise ValueError("Layer 2 identity required")
        validate_section(section, review, expected)
        compiled2.append(compile_section(section))
        hashes[expected["id"]] = content_hash(section)
    fronts = [
        normalized(row["text"])
        for section in compiled2
        for card in section["cards"]
        for row in card["front"]
    ]
    if len(set(fronts)) != len(fronts):
        raise ValueError("Duplicate clinical vignette across layer-2 sections")
    supplement = compile_section(authored)
    base = json.loads((output / "manifest.json").read_text())
    base_index = json.loads((output / "index.json").read_text())
    if any(s["id"] == "35" for s in base["sections"]):
        raise ValueError("Rebuild original study data before adding supplements")
    base["layer"] = 1
    base["original_content_sha256"] = base["content_sha256"]
    base["content_sha256"] = content_hash(
        {"original": base["content_sha256"], "supplement": content_hash(authored)}
    )
    base["sections"].append(
        {
            "id": "35",
            "title": authored["title"],
            "blocks": len(supplement["blocks"]),
            "cards": len(supplement["cards"]),
            "url": "sections/35.json",
        }
    )
    extra_counts = manifest_for([supplement], {"35": content_hash(authored)}, 1)["counts"]
    for key, value in extra_counts.items():
        base["counts"][key] += value
    base["groups"].extend(
        {
            "id": b["id"],
            "title": b["title"],
            "section_id": "35",
            "problem": b["title"],
            "related_sections": b["related_sections"],
        }
        for b in supplement["blocks"]
    )
    write_json(output / "sections/35.json", supplement)
    write_index(output, base, [*base_index["cards"], *supplement["cards"]])
    second = output / "layers/capa2"
    manifest2 = manifest_for(compiled2, hashes, 2)
    manifest2["groups"] = [
        {
            "id": b["id"],
            "title": b["title"],
            "section_id": s["id"],
            "problem": b["title"],
            "related_sections": b["related_sections"],
        }
        for s in compiled2
        for b in s["blocks"]
    ]
    manifest2["coverage"] = {
        "sections": len(required),
        "scenarios": sum(len(s["cards"]) for s in compiled2),
        "section_hashes": hashes,
    }
    for section in compiled2:
        write_json(second / f"sections/{section['id']}.json", section)
    write_index(second, manifest2, [c for s in compiled2 for c in s["cards"]])
    return {"capa1": base["counts"], "capa2": manifest2["counts"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("content/layers"))
    parser.add_argument("--output", type=Path, default=Path("app/public/study"))
    args = parser.parse_args()
    print(
        json.dumps(
            build_layers(
                args.source, args.output, json.loads(Path("content/curriculum.json").read_text())
            ),
            ensure_ascii=False,
        )
    )
