import json
import os
from copy import deepcopy
from math import ceil

# ======== USER CONFIGURATION ========
models = ['lesan', 'google']

src_file = "../dataset/translations/MIMIC-en-ti.json"
source_language = 'eng'
target_language = "tir"
dataset_name = "MIMIC"
dataset_domain = "Health"
batch_size = 30
input_key = "eng"

languages = [
    {"iso_name": "English", "iso_639_1": "en", "iso_639_3": "eng"},
    {"iso_name": "Amharic", "iso_639_1": "am", "iso_639_3": "amh"},
    {"iso_name": "Tigrinya", "iso_639_1": "ti", "iso_639_3": "tir"},
    {"iso_name": "Oromo", "iso_639_1": "or", "iso_639_3": "orm"},
]

translation_template = {
    "output": "",
    "model": "",
    "rate": 0,
    "rank": 0,
}

task_template = {
    "id": "",
    "input": "",
    "models": [],
    "reference": "",
    "domain": ""
}

batch_template = {
    "batch_id": "",
    "dataset_name": "",
    "dataset_domain": "",
    "batch_name": "",
    "source_language": {},
    "target_language": {},
    "tasks": [],
    "domains": []
}

# ======== FUNCTIONS ========

def build_task(item, task_id, input_key, models, target_language, dataset_domain):
    """Builds a single translation task"""
    task = deepcopy(task_template)
    task["id"] = str(task_id)
    task["input"] = item.get(input_key, "")
    task["domain"] = dataset_domain

    model_outputs = []
    for model in models:
        key_variants = [f"{model}_{target_language}", f"{model}_{target_language[:3]}"]
        output_text = ""
        for key in key_variants:
            if key in item:
                output_text = item[key]
                break

        model_entry = deepcopy(translation_template)
        model_entry["model"] = model
        model_entry["output"] = output_text
        model_outputs.append(model_entry)

    task["models"] = model_outputs
    return task


def build_batch(batch_id, items, models, source_language, target_language,
                dataset_name, dataset_domain, languages):
    """Builds one complete batch JSON"""
    batch = deepcopy(batch_template)
    batch["batch_id"] = str(batch_id)
    batch["dataset_name"] = dataset_name
    batch["dataset_domain"] = dataset_domain
    batch["batch_name"] = f"{dataset_name}-{source_language}-{target_language}-batch-{batch_id}-{len(items)}-tasks"

    batch["source_language"] = next((lang for lang in languages if lang["iso_639_3"] == source_language), {})
    batch["target_language"] = next((lang for lang in languages if lang["iso_639_3"] == target_language), {})

    tasks = [build_task(item, i+1, input_key, models, target_language, dataset_domain) for i, item in enumerate(items)]
    batch["tasks"] = tasks
    batch["domains"] = [dataset_domain]
    return batch


def split_into_batches(data, batch_size):
    """Split data into chunks"""
    for i in range(0, len(data), batch_size):
        yield data[i:i + batch_size]


# ======== MAIN SCRIPT ========

def main():
    if not os.path.exists(src_file):
        raise FileNotFoundError(f"File not found: {src_file}")

    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_batches = ceil(len(data) / batch_size)
    print(f"📦 Total items: {len(data)} → Generating {total_batches} batches of up to {batch_size} each")

    # os.makedirs("../dataset/tasks/mt", exist_ok=True)
    diretory_path = f"../dataset/tasks/mt/{dataset_name}/{source_language}-{target_language}/{len(models)}models"
    if not os.path.exists(diretory_path):
        os.makedirs(diretory_path, exist_ok=True)

    for batch_num, chunk in enumerate(split_into_batches(data, batch_size), start=1):
        batch_json = build_batch(
            batch_id=batch_num,
            items=chunk,
            models=models,
            source_language=source_language,
            target_language=target_language,
            dataset_name=dataset_name,
            dataset_domain=dataset_domain,
            languages=languages
        )

        output_file = f"{diretory_path}/{dataset_name}-{source_language}-{target_language}-batch-{batch_num}.json"
        with open(output_file, "w", encoding="utf-8") as out:
            json.dump(batch_json, out, ensure_ascii=False, indent=2)

        print(f"✅ Saved batch {batch_num}: {output_file}")


if __name__ == "__main__":
    main()




# {
#   "batch_id": "",
#   "dataset_name": "HornMT-01",
#   "dataset_domain": "General",
#   "batch_name": "HornMT-01-eng-tir-15-tasks",
#   "source_language": {
#     "iso_name": "English",
#     "iso_639_1": "en",
#     "iso_639_3": "eng"
#   },
#   "target_language": {
#     "iso_name": "Tigrinya",
#     "iso_639_1": "tg",
#     "iso_639_3": "tir"
#   },
#   "tasks": [
#     {
#       "id": "1",
#       "input": "Robert Kaplan, head of the Federal Reserve Bank of Dallas, says that low bond yields suggest sluggish growth ahead for the economy of the United States.",
#       "models": [
#         {
#           "output": "ሓላፊ ፈደራላዊ ማዕከን ዳላስ ዝዀነ ሮበርት ካፕላን ፡ ትሑት ምትእስሳር ፡ ኣብ ቊጠባ ሕቡራት መንግስትታት ኣመሪካ ሃሳዪ ዕቤት ከም ዝህሉ እዩ ዝሕብር ። ―",
#           "model": "google-translate",
#           "rate": 0,
#           "rank": 0
#         },
#         {
#           "output": "ሓላፊ ባንኪ ፌደራል ሪዘርቭ ዳላስ ሮበርት ካፕላን ትሑት ምህርቲ ቦንድ ንቁጠባ ኣሜሪካ ድኹም ዕብየት ከምዝጽበዮ ይሕብር። .",
#           "model": "lesan",
#           "rate": 0,
#           "rank": 0
#         },
#         {
#           "output": "ሓላፊ ባንኪ ፌደራል ሪዘርቭ ዳላስ ሮበርት ካፕላን ትሑት ምህርቲ ቦንድ ንቁጠባ ኣሜሪካ ድኹም ዕብየት ከምዝጽበዮ ይሕብር። .",
#           "model": "nllb",
#           "rate": 0,
#           "rank": 0
#         }
#       ]
#     }
#   ]
# }


# [
#   {
#     "eng": "Any changes in your vision, hearing or balance?",
#     "lesan_amh": "በራእይ ፣ በመስማት ወይም በሚዛናዊነት ረገድ የተደረጉ ለውጦች ይኖሩ ይሆን?",
#     "google_amh": "በእርስዎ እይታ፣ መስማት ወይም ሚዛን ላይ ለውጦች አሉ?"
#   },
#   {
#     "eng": "OK, it sounds like he has a sore throat that's been persistent and we can do this thing called the Centor score. So it looks like he has had a fever, no cough, a sore throat. ",
#     "lesan_amh": "እሺ ፣ ያለማቋረጥ ጉሮሮውን የቀዘቀዘ ይመስላል እናም ይህን የመቶር ውጤት ተብሎ የሚጠራ ነገር ማድረግ እንችላለን ። ስለዚህ ትኩሳት ፣ ሳል ፣ የጉሮሮ ቁስል ያለበት ይመስላል ።",
#     "google_amh": "እሺ፣ የማያቋርጥ የጉሮሮ ህመም እንዳለበት ይሰማል እና ሴንተር ውጤት የሚባል ነገር ልንሰራው እንችላለን። ስለዚህ ትኩሳት፣ ሳል፣ የጉሮሮ መቁሰል ያለበት ይመስላል።"
#   }
# ]