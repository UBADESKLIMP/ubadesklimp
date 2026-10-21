"""Liga o codigo ao SQL no grafo do graphify.

O extrator nao ve `supabase.rpc('nome')` nem `supabase.from('tabela')` como
arestas, entao tela -> hook -> funcao SQL fica quebrado no grafo. Este script
le essas chamadas em src/ e supabase/functions/ e acrescenta ao graph.json:

  calls_rpc      arquivo -> public.<funcao>()   (definicao mais recente)
  queries_table  arquivo -> public.<tabela>     (definicao mais antiga)

Rode depois de qualquer `/graphify` (build completo ou --update), porque o
rebuild apaga essas arestas. E idempotente: rodar duas vezes nao duplica.

Uso (na raiz do repo):
  python scripts/graphify_sql_links.py [graph.json ...] [--html]

Sem argumentos usa graphify-out/graph.json e, se existir,
graphify-out/filtered/graph.json. Com --html regera o graph.html de cada um.
"""
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

CALL = re.compile(r"\.(rpc|from)\(\s*['\"]([a-z0-9_]+)['\"]")
SOURCE_DIRS = ("src", "supabase/functions")
DEFAULT_GRAPHS = ("graphify-out/graph.json", "graphify-out/filtered/graph.json")


def collect_calls():
    calls = defaultdict(lambda: defaultdict(set))
    for base in SOURCE_DIRS:
        for p in Path(base).rglob("*"):
            if p.suffix not in (".ts", ".tsx"):
                continue
            text = p.read_text(encoding="utf-8", errors="replace")
            for kind, name in CALL.findall(text):
                calls[p.as_posix()][kind].add(name)
    return calls


def link(graph_path, calls):
    d = json.loads(Path(graph_path).read_text(encoding="utf-8"))
    nodes = d["nodes"]

    file_node = {
        n["source_file"].replace("\\", "/"): n["id"]
        for n in nodes
        if n.get("source_location") == "L1" and n.get("source_file")
    }
    functions, tables = defaultdict(list), defaultdict(list)
    for n in nodes:
        if not (n.get("source_file") or "").endswith(".sql"):
            continue
        m = re.fullmatch(r"public\.([a-z0-9_]+)\(\)", n["label"])
        if m:
            functions[m.group(1)].append(n)
        m = re.fullmatch(r"public\.([a-z0-9_]+)", n["label"])
        if m:
            tables[m.group(1)].append(n)

    have = {(l["source"], l["target"], l["relation"]) for l in d["links"]}
    added, missing = 0, set()

    def add(src, tgt, relation, context, source_file):
        nonlocal added
        if (src, tgt, relation) in have:
            return
        d["links"].append({
            "source": src, "target": tgt, "relation": relation,
            "_origin": "ast", "confidence": "EXTRACTED", "confidence_score": 1.0,
            "context": context, "source_file": source_file,
            "source_location": "", "weight": 1.0,
        })
        have.add((src, tgt, relation))
        added += 1

    for f, kinds in sorted(calls.items()):
        src = file_node.get(f)
        if not src:
            continue
        for name in sorted(kinds["rpc"]):
            defs = functions.get(name)
            if not defs:
                missing.add(("rpc", name))
                continue
            add(src, max(defs, key=lambda n: n["source_file"])["id"], "calls_rpc", "rpc", f)
        for name in sorted(kinds["from"]):
            defs = tables.get(name)
            if not defs:
                missing.add(("from", name))
                continue
            add(src, min(defs, key=lambda n: n["source_file"])["id"], "queries_table", "from", f)

    Path(graph_path).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    print(f"{graph_path}: {added} arestas novas, {len(missing)} nomes sem definicao em .sql")
    for kind, name in sorted(missing):
        print(f"  sem match: {kind} '{name}'")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    html = "--html" in sys.argv
    graphs = args or [g for g in DEFAULT_GRAPHS if Path(g).exists()]
    if not graphs:
        sys.exit("Nenhum graph.json encontrado. Rode /graphify primeiro.")
    calls = collect_calls()
    print(f"{len(calls)} arquivos com chamadas rpc/from")
    for g in graphs:
        link(g, calls)
        if html:
            subprocess.run(["graphify", "export", "html", "--graph", g], check=False)


if __name__ == "__main__":
    main()
