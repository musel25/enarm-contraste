"""Build review files and an Anki package from authored, source-linked draft cards.

This script exports existing content. It does not generate or approve medical facts.
Run: uv run python scripts/build_pilot.py
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sqlite3
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import genanki

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"ancla", "contraste", "microvariacion", "discriminador", "primera_decision"}
LABELS = {"ancla": "Ancla", "contraste": "Contraste", "microvariacion": "Microvariación", "discriminador": "Discriminador", "primera_decision": "Primera decisión"}


def marked(text: str) -> str:
    """Escape authored text, allowing only the explicit discriminator marker."""
    return re.sub(r"\[\[(.*?)\]\]", r'<span class="key">\1</span>', html.escape(text))


def validate(data: dict) -> None:
    cards = data["cards"]
    assert len(cards) == 10, "This pilot must contain exactly ten cards"
    ids = {card["id"] for card in cards}
    assert len(ids) == len(cards), "Duplicate card ID"
    allowed_pages = set(data["book"]["pilot_pages"])
    assert allowed_pages == {135, 138}, "Pilot scope changed"
    assert data["book"]["complete_book_pages"] == 1150
    assert data["book"]["excerpt_pages"] == 221
    for card in cards:
        for field in ("case", "question", "answer", "mechanism", "contrast", "first_decision", "limit"):
            assert isinstance(card[field], str) and card[field].strip(), f'{card["id"]}: empty {field}'
        assert card["type"] in KINDS
        assert card["case"].count("[[") == card["case"].count("]]") == 1, f'{card["id"]}: use one highlight'
        assert set(card["book_pages"]) <= allowed_pages
        assert card["book_pages"]
        assert set(card["guidelines"]) <= set(data["references"])
        assert set(card["links"]) <= ids
        assert card["id"] not in card["links"]
        if card["type"] == "ancla":
            assert not re.search(r"coledocolitiasis|colangitis", card["case"] + card["question"], re.I), "Answer leaked in anchor"
            assert len(re.findall(r"[.!?](?:\s|$)", card["case"])) == 1, "Anchor must be one sentence"
        if card["type"] == "microvariacion":
            change = card["change"]
            assert set(change) == {"field", "before", "after", "unchanged"}
            assert change["before"] != change["after"]
            assert change["before"] in card["case"] and change["after"] in card["case"]
            assert len(change["unchanged"]) >= 3
    for concept in {card["concept"] for card in cards}:
        assert Counter(card["type"] for card in cards if card["concept"] == concept) == Counter({kind: 1 for kind in KINDS})


def source_html(card: dict, data: dict) -> str:
    pages = ", ".join(map(str, card["book_pages"]))
    text = f'{html.escape(data["book"]["filename"])} · páginas {pages}.'
    refs = [f'<a href="{html.escape(data["references"][key]["url"], quote=True)}">{html.escape(data["references"][key]["label"])}</a>' for key in card["guidelines"]]
    return text + "<br>" + "<br>".join(refs)


def back_fields(card: dict, data: dict) -> list[str]:
    return [card["id"], LABELS[card["type"]], marked(card["case"]) + '<p class="prompt">' + html.escape(card["question"]) + '</p>', *[html.escape(card[key]) for key in ("answer", "mechanism", "contrast", "first_decision", "limit")], source_html(card, data)]


ANKI_CSS = """
.card { font-family: 'Source Sans 3', Arial, sans-serif; font-size: 19px; line-height: 1.65; text-align:left; color:#253047; background:#F3F6FC; margin:0; padding:24px; }
.wrap { max-width:720px; margin:auto; background:#FFFFFF; padding:26px; border-radius:12px; }
.meta { color:#606B80; font-size:12px; margin-bottom:22px; }
.key { color:#92500A; background:#FFF0D9; font-weight:600; padding:1px 3px; border-radius:3px; }
.prompt { font-weight:600; margin-top:24px; }
.answer { font-family:Outfit,Arial,sans-serif; font-size:25px; line-height:1.35; color:#304FC5; }
.label { color:#304FC5; font-size:13px; margin-bottom:4px; font-weight:600; }
.section { margin-top:20px; }
.source { font-size:12px; color:#606B80; margin-top:26px; overflow-wrap:anywhere; }
a { color:#304FC5; }
hr { border:0; border-top:1px solid #DCE3EF; margin:28px 0; }
.nightMode.card { background:#111B2B; color:#E7EDFA; }
.nightMode .wrap { background:#1B2940; }
.nightMode .key { background:#493410; color:#FFD39A; }
.nightMode .answer,.nightMode .label,.nightMode a { color:#ABBEFF; }
.nightMode .meta,.nightMode .source { color:#BAC6DD; }
@media(max-width:400px) { .card { padding:12px; font-size:18px; } .wrap { padding:20px; } }
"""


def export_anki(data: dict, directory: Path) -> None:
    fields = ["Id", "Tipo", "Frente", "Respuesta", "Funcion", "Contraste", "PrimeraDecision", "Limite", "Fuente"]
    model = genanki.Model(
        1964568101, "ENARM Contraste - Cobalto - Capa 1 v1",
        fields=[{"name": name} for name in fields],
        templates=[{
            "name": "Reconocimiento y contraste",
            "qfmt": '<div class="wrap"><div class="meta">Vía biliar · Capa 1 · {{Tipo}} · {{Id}} · Borrador</div>{{Frente}}</div>',
            "afmt": '{{FrontSide}}<div class="wrap"><hr><div class="answer">{{Respuesta}}</div><div class="section"><div class="label">Función mínima</div>{{Funcion}}</div><div class="section"><div class="label">Contraste</div>{{Contraste}}</div><div class="section"><div class="label">Primera decisión</div>{{PrimeraDecision}}</div><div class="section"><div class="label">Límite del patrón</div>{{Limite}}</div><div class="source">Viñeta didáctica construida; cifras ilustrativas.<br>{{Fuente}}<br>Revisión médica profesional pendiente.</div></div>'
        }], css=ANKI_CSS,
    )
    deck = genanki.Deck(1964568102, "ENARM Contraste::Piloto biliar - BORRADOR")
    for card in data["cards"]:
        deck.add_note(genanki.Note(model=model, fields=back_fields(card, data), guid=genanki.guid_for("enarm-contraste-pilot", card["id"]), tags=["capa::1", "estado::borrador", "bloque::via_biliar", "tipo::" + card["type"]]))
    path = directory / "enarm-contraste-piloto.apkg"
    genanki.Package(deck).write_to_file(str(path))
    # Check the actual package, rather than assuming export succeeded.
    with zipfile.ZipFile(path) as package, tempfile.TemporaryDirectory() as temporary:
        database = Path(temporary) / "collection.anki2"
        database.write_bytes(package.read("collection.anki2"))
        with sqlite3.connect(database) as connection:
            assert connection.execute("select count(*) from notes").fetchone()[0] == 10
            assert connection.execute("select count(*) from cards").fetchone()[0] == 10
            assert len({row[0] for row in connection.execute("select guid from notes")}) == 10
            actual_model = next(iter(json.loads(connection.execute("select models from col").fetchone()[0]).values()))
            assert "{{Respuesta}}" not in actual_model["tmpls"][0]["qfmt"]
            assert "{{Fuente}}" not in actual_model["tmpls"][0]["qfmt"]


def build(source: Path, directory: Path) -> None:
    data = json.loads(source.read_text(encoding="utf-8"))
    validate(data)
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    data["content_sha256"] = digest
    template = (ROOT / "scripts" / "review-template.html").read_text(encoding="utf-8")
    assert template.count("__PILOT_DATA__") == 1
    payload = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    fragment = template.replace("__PILOT_DATA__", payload)
    (directory / "revision-inline.html").write_text(fragment, encoding="utf-8")
    document = '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ENARM Contraste · Piloto biliar</title><style>html,body{margin:0;background:#F3F6FC}body{padding:20px} @media(max-width:500px){body{padding:8px}}</style></head><body>' + fragment + '</body></html>'
    (directory / "revision-cobalto.html").write_text(document, encoding="utf-8")
    (directory / "tarjetas.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    export_anki(data, directory)
    readme = """ENARM CONTRASTE - PILOTO BILIAR

1. Abre revision-cobalto.html para evaluar las diez tarjetas.
2. Lee el mapa horizontal antes de iniciar la muestra.
3. Usa Mostrar respuesta para ver explicación, contraste y fuentes.
4. Evalúa cada tarjeta: Conservar, Ajustar o Descartar. Puedes añadir un comentario.
5. Exporta tu revisión antes de cerrar. La página intenta guardar también en este navegador.
6. Importa enarm-contraste-piloto.apkg en Anki si quieres revisar el formato de las tarjetas.

El libro completo tiene 1,150 páginas. Este piloto usa solo las páginas 135 y 138 del extracto.
No contiene el PDF. Los casos y sus cifras son ejemplos didácticos construidos.
Todas las tarjetas son borradores pendientes de evaluación y revisión médica profesional.
Los nombres de las enfermedades y las referencias se muestran al revelar la respuesta.
El mapa general sí muestra las dos categorías, como parte de la orientación inicial.

La revisión del HTML y las respuestas de Anki son registros distintos. Este piloto no los sincroniza.
Los comentarios del HTML se conservan localmente cuando el navegador lo permite; no se envían a un servidor.
La tipografía de Anki puede usar las fuentes disponibles en el dispositivo. Los colores y el resaltado se incluyen en el mazo.

REGENERAR
En la raíz del repositorio:
uv sync
uv run python scripts/build_pilot.py

El script exporta el contenido de content/piloto-biliar.json. No inventa nuevas tarjetas ni aprueba información médica.
"""
    (directory / "LEEME.txt").write_text(readme, encoding="utf-8")
    with zipfile.ZipFile(directory / "enarm-contraste-piloto.zip", "w", zipfile.ZIP_DEFLATED) as package:
        for name in ["revision-cobalto.html", "enarm-contraste-piloto.apkg", "tarjetas.json", "LEEME.txt"]:
            package.write(directory / name, name)
    print(json.dumps({"cards": len(data["cards"]), "concepts": 2, "book_pages": data["book"]["pilot_pages"], "content_sha256": digest, "output": str(directory)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "content" / "piloto-biliar.json")
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "piloto-biliar")
    args = parser.parse_args()
    build(args.source, args.output)
