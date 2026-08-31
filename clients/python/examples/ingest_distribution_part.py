"""Turn a distribution part's batch-NN.tsv files into HornEval TTS annotation batches.

One TSV = one HornEval batch = one voice actor (~200 prompts, ~32 min of speech).
Prompts are uploaded verbatim; a reviewer can correct text in the app afterwards.
"""
import argparse
import csv
import pathlib
import sys

from horneval import HornEval, ConflictError, HornEvalError

# Must match an entry in src/constants/languages.ts so the app renders it.
LANGUAGES = {
    "so": {"iso_name": "Somali", "iso_639_1": "so", "iso_639_3": "som"},
    "am": {"iso_name": "Amharic", "iso_639_1": "am", "iso_639_3": "amh"},
    "ti": {"iso_name": "Tigrinya", "iso_639_1": "ti", "iso_639_3": "tir"},
}


def read_prompts(tsv_path):
    with open(tsv_path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        return [
            {"id": row["passage_id"], "input": row["text"].strip(), "reference": ""}
            for row in reader
            if row.get("passage_id") and row.get("text", "").strip()
        ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part_dir")
    ap.add_argument("--lang-code", default="so")
    ap.add_argument("--domain", default="read-speech")
    ap.add_argument("--prefix", default=None, help="batch name prefix (default: <lang>-<part dir name>)")
    ap.add_argument("--limit", type=int, default=None, help="only ingest the first N batch files")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.lang_code not in LANGUAGES:
        sys.exit(f"Unknown --lang-code {args.lang_code!r}; known: {', '.join(LANGUAGES)}")

    part = pathlib.Path(args.part_dir).expanduser().resolve()
    tsvs = sorted(part.glob("batch-*.tsv"))
    if not tsvs:
        sys.exit(f"No batch-*.tsv files in {part}")
    if args.limit:
        tsvs = tsvs[: args.limit]

    prefix = args.prefix or f"{args.lang_code}-{part.name}"
    client = None if args.dry_run else HornEval()

    created, skipped, failed = [], [], []
    for tsv in tsvs:
        prompts = read_prompts(tsv)
        name = f"{prefix}-{tsv.stem}"  # e.g. so-part-03-train-batch-01

        if args.dry_run:
            print(f"[dry-run] {name}: {len(prompts)} prompts (first id {prompts[0]['id']})")
            continue

        try:
            before = {b["batch_name"] for b in client.list_batches("tts")}
            result = client.create_batch(
                dataset_type="tts",
                batch_name=name,
                dataset_domain=args.domain,
                language=LANGUAGES[args.lang_code],
                workflow="annotation",
                tasks=prompts,
                idempotency_key=f"ingest-{name}",
            )
            # An Idempotency-Key replay returns the original response, so the
            # batch already existing is a no-op, not a fresh create.
            if name in before:
                skipped.append(name)
                print(f"  no-op   {name}: already ingested -> {result['batch_id']}")
            else:
                created.append((name, result["batch_id"], result["number_of_tasks"]))
                print(f"  created {name}: {result['number_of_tasks']} tasks -> {result['batch_id']}")
        except ConflictError:
            skipped.append(name)
            print(f"  skipped {name}: a batch with that name already exists")
        except HornEvalError as e:
            failed.append((name, str(e)))
            print(f"  FAILED  {name}: {e}")

    if not args.dry_run:
        print(f"\ncreated={len(created)} skipped={len(skipped)} failed={len(failed)}")
        if failed:
            sys.exit(1)


if __name__ == "__main__":
    main()
