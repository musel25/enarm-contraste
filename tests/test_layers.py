import copy
import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_full_decks import planner_card
from scripts.build_layers import (
    build_layers,
    compile_section,
    content_hash,
    manifest_for,
    validate_section,
)


def fixture():
    scenarios = [
        {
            "id": f"01.01-0{i + 1}-variante",
            "anchor_topic_ids": [f"01.01-0{1 + i % 2}"],
            "objective": "contraste" if i == 0 else "gravedad",
            "vignette": f"Escenario original {i}. Aparece el dato decisivo {i}.",
            "question": "¿Qué decisión cambia?",
            "answer": f"Decisión condicionada {i}",
            "discriminator": f"dato decisivo {i}",
            "reason": "La explicación depende de los hallazgos disponibles.",
            "initial_action": "Comprobar el contexto antes de actuar.",
            "limits": "No se puede inferir una causa sin datos adicionales.",
            "evidence": [
                {
                    "source_id": "source",
                    "locator": "Apartado 2",
                    "support": "Respaldo específico de la decisión.",
                }
            ],
        }
        for i in range(3)
    ]
    section = {
        "schema_version": 1,
        "layer": 2,
        "section_id": "01",
        "title": "Sección",
        "author": "author",
        "mexico_source_note": "Límite concreto de la búsqueda nacional.",
        "sources": [
            {
                "id": "source",
                "label": "Documento primario",
                "url": "https://example.org/guidance",
                "version": "2026",
                "checked_at": "2026-11-06",
                "region": "international",
                "access": "checked",
                "locator": "Apartados 1–3",
            }
        ],
        "blocks": [
            {
                "id": "01.01",
                "title": "Problema compartido",
                "related_sections": ["02"],
                "scenarios": scenarios,
            }
        ],
    }
    expected = {
        "id": "01",
        "blocks": [{"id": "01.01", "topics": [{"id": "01.01-01"}, {"id": "01.01-02"}]}],
    }
    review = {
        "section_id": "01",
        "layer": 2,
        "author": "author",
        "reviewer": "reviewer",
        "content_sha256": content_hash(section),
        "status": "approved",
        "professional_review": "pending",
        "source_ids_checked": ["source"],
        "scenario_ids": [c["id"] for c in scenarios],
        "issues": [],
        "notes": ["Comprobación independiente."],
    }
    return section, expected, review


class LayerTests(unittest.TestCase):
    def test_build_preserves_original_sections_anki_and_index_entries(self):
        section, expected, review = fixture()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, output = root / "source", root / "study"

            def write(path, value):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(value, ensure_ascii=False))

            def reviewed(value):
                result = {
                    **review,
                    "section_id": value["section_id"],
                    "layer": value["layer"],
                    "content_sha256": content_hash(value),
                    "scenario_ids": [c["id"] for b in value["blocks"] for c in b["scenarios"]],
                }
                write(source / f"capa{value['layer']}/{value['section_id']}.json", value)
                write(source / f"reviews/capa{value['layer']}/{value['section_id']}.json", result)

            reviewed(section)
            hydro = {**copy.deepcopy(section), "section_id": "35", "layer": 1, "blocks": []}
            for number in range(1, 11):
                bid = f"35.{number:02}"
                block = {
                    "id": bid,
                    "title": f"Bloque {number}",
                    "related_sections": ["01"],
                    "scenarios": [],
                }
                for i in range(2):
                    case = copy.deepcopy(section["blocks"][0]["scenarios"][i])
                    case.update(
                        id=f"{bid}-0{i + 1}-ancla",
                        objective="ancla",
                        anchor_topic_ids=[f"{bid}-0{i + 1}"],
                        vignette=f"Bloque {number} caso {i}: dato decisivo {i}.",
                    )
                    block["scenarios"].append(case)
                hydro["blocks"].append(block)
            reviewed(hydro)
            second_hydro = copy.deepcopy(hydro)
            second_hydro["layer"] = 2
            case = copy.deepcopy(second_hydro["blocks"][0]["scenarios"][0])
            case.update(id="35.01-03-variante", vignette="Escenario adicional con dato decisivo 0.")
            second_hydro["blocks"][0]["scenarios"].append(case)
            reviewed(second_hydro)
            original = compile_section({**section, "layer": 1})
            base = manifest_for([original], {"01": "old-hash"}, 1)
            base["groups"] = []
            original_index = [planner_card(c, i) for i, c in enumerate(original["cards"])]
            write(output / "manifest.json", base)
            write(output / "index.json", {"cards": original_index})
            write(output / "sections/01.json", original)
            sentinel = (output / "sections/01.json").read_bytes()
            (output / "enarm-eje.apkg").write_bytes(b"original-anki")
            result = build_layers(source, output, {"sections": [expected]})
            self.assertEqual(result["capa1"]["cards"], 23)
            self.assertEqual(result["capa2"]["sections"], 2)
            self.assertEqual((output / "sections/01.json").read_bytes(), sentinel)
            self.assertEqual((output / "enarm-eje.apkg").read_bytes(), b"original-anki")
            index = json.loads((output / "index.json").read_text())
            self.assertEqual(index["cards"][:3], original_index)
            self.assertEqual(index["cards"][3]["objective"], "ancla")
            second_manifest = json.loads((output / "layers/capa2/manifest.json").read_text())
            self.assertEqual(second_manifest["groups"][0]["related_sections"], ["02"])
            second_hydro["blocks"][0]["scenarios"][0]["vignette"] = section["blocks"][0][
                "scenarios"
            ][0]["vignette"]
            reviewed(second_hydro)
            with self.assertRaisesRegex(ValueError, "Duplicate clinical vignette"):
                build_layers(source, output, {"sections": [expected]})
            (source / "reviews/capa2/01.json").unlink()
            write(output / "manifest.json", base)
            write(output / "index.json", {"cards": original_index})
            with self.assertRaises(FileNotFoundError):
                build_layers(source, output, {"sections": [expected]})
            preview = build_layers(source, output, {"sections": [expected]}, reviewed_only=True)
            self.assertEqual(preview["capa2"]["sections"], 1)
            coverage = json.loads((output / "layers/capa2/manifest.json").read_text())["coverage"]
            self.assertEqual(coverage["sections"], 1)
            self.assertEqual(coverage["required_sections"], 2)

    def test_requires_an_independent_current_review(self):
        section, expected, review = fixture()
        validate_section(section, review, expected)
        for bad in [
            None,
            {**review, "reviewer": "author"},
            {**review, "content_sha256": "old"},
            {**review, "scenario_ids": []},
            {**review, "source_ids_checked": []},
        ]:
            with self.assertRaises(ValueError):
                validate_section(section, bad, expected)

    def test_rejects_unchecked_sources_and_unknown_evidence(self):
        section, expected, review = fixture()
        section["sources"][0]["access"] = "pending"
        with self.assertRaisesRegex(ValueError, "source|fuente"):
            validate_section(section, review, expected)

    def test_rejects_incorrect_review_field_types_without_coercion(self):
        section, expected, review = fixture()
        for key in ["scenario_ids", "source_ids_checked"]:
            for value in [1, {"source": 1}, [{}]]:
                with self.assertRaises(ValueError):
                    validate_section(section, {**review, key: value}, expected)
        section["layer"] = 1
        review = {**review, "layer": True, "content_sha256": content_hash(section)}
        with self.assertRaises(ValueError):
            validate_section(section, review, expected)
        section, expected, review = fixture()
        section["blocks"][0]["scenarios"][0]["evidence"][0]["source_id"] = "unknown"
        with self.assertRaisesRegex(ValueError, "evidence|evidencia"):
            validate_section(section, review, expected)

    def test_requires_anchor_coverage_and_more_unique_scenarios(self):
        section, expected, review = fixture()
        section["blocks"][0]["scenarios"] = section["blocks"][0]["scenarios"][:2]
        with self.assertRaisesRegex(ValueError, "coverage|cobertura"):
            validate_section(section, review, expected)
        section, expected, review = fixture()
        for scenario in section["blocks"][0]["scenarios"]:
            scenario["anchor_topic_ids"] = ["01.01-01"]
        with self.assertRaisesRegex(ValueError, "coverage|cobertura"):
            validate_section(section, review, expected)

    def test_rejects_duplicate_id_vignette_and_missing_literal_discriminator(self):
        for field in ["id", "vignette"]:
            section, expected, review = fixture()
            cases = section["blocks"][0]["scenarios"]
            cases[1][field] = cases[0][field]
            with self.assertRaises(ValueError):
                validate_section(section, review, expected)
        section, expected, review = fixture()
        section["blocks"][0]["scenarios"][0]["discriminator"] = "ausente"
        with self.assertRaises(ValueError):
            validate_section(section, review, expected)

    def test_compiles_one_identity_per_scenario_without_mutating_authoring(self):
        section, expected, review = fixture()
        before = copy.deepcopy(section)
        validate_section(section, review, expected)
        compiled = compile_section(section)
        self.assertEqual(section, before)
        self.assertEqual(len(compiled["cards"]), 3)
        self.assertEqual(len({c["id"] for c in compiled["cards"]}), 3)
        for card in compiled["cards"]:
            self.assertTrue(card["id"].startswith("capa2/"))
            self.assertEqual(card["section_id"], "01")
            self.assertTrue(card["sources"])
            self.assertNotIn(card["back"][0]["title"], card["front"][0]["text"])
        self.assertEqual(compiled["cards"][0]["family"], "eje")
        self.assertEqual(compiled["cards"][1]["level"], 4)

    def test_objective_edits_preserve_scheduled_identity_in_both_layers(self):
        for layer in (1, 2):
            section, _, _ = fixture()
            section["layer"] = layer
            first = compile_section(section)["cards"][0]
            section["blocks"][0]["scenarios"][0]["objective"] = "variante"
            changed = compile_section(section)["cards"][0]
            self.assertNotEqual(first["family"], changed["family"])
            self.assertNotEqual(first["objective"], changed["objective"])
            self.assertEqual(first["id"], changed["id"])


if __name__ == "__main__":
    unittest.main()
