import json
import copy
import random
import os

# ------------------ Language and Template Definitions ------------------

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
    "id": "1",
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
    "tasks": "",
    "domains": []
}

# ------------------ Utility Functions ------------------

def get_domains():
    with open("./domains.json", 'r', encoding="utf-8") as f:
        return json.load(f)

def get_rating_guideline():
    with open("./taus_rating_guideline.json", 'r', encoding="utf-8") as f:
        return json.load(f)

def save_json(data, destination):
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with open(destination, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)

def find_language(lang_code):
    lang_code = lang_code.strip().lower()
    for lang in languages:
        if lang_code in {
            lang['iso_name'].lower(),
            lang['iso_639_1'].lower(),
            lang['iso_639_3'].lower()
        }:
            return lang
    raise ValueError(f"Language '{lang_code}' not found in language list.")

# ------------------ Main Batch Generator ------------------

def generate_multiple_batches(src_file, dataset_name, dataset_domain, source_language, target_language, models, batch_size=15):
    titles = ["A", "B", "C", "D", "E", "F"]
    num_models = len(models)

    with open(src_file, 'r', encoding="utf-8") as file:
        data = json.load(file)
        data = [item for item in data if len(item.get(source_language, '')) > 150]

    total_available = len(data)
    if total_available < batch_size:
        raise ValueError(f"Not enough data to form even one batch. Found {total_available}, required minimum {batch_size}")

    used_indices = set()
    batch_number = 1

    while len(used_indices) + batch_size <= total_available:
        batch_tasks = copy.deepcopy(batch_template)
        batch_tasks['dataset_name'] = dataset_name
        batch_tasks['dataset_domain'] = dataset_domain
        batch_tasks['batch_id'] = f"{dataset_name}-{str(batch_number).zfill(2)}"
        batch_tasks['batch_name'] = f"{dataset_name}-{source_language}-{target_language}-batch-{str(batch_number).zfill(2)}"
        batch_tasks['source_language'] = find_language(source_language)
        batch_tasks['target_language'] = find_language(target_language)

        tasks = []
        task_title_model_mapping = {}

        # Unique random samples
        remaining_indices = list(set(range(total_available)) - used_indices)
        selected_indices = random.sample(remaining_indices, batch_size)
        used_indices.update(selected_indices)

        for idx, data_idx in enumerate(selected_indices):
            item = data[data_idx]
            task_id = str(idx + 1)
            task = copy.deepcopy(task_template)
            task['id'] = task_id
            task['input'] = item[source_language]
            task['models'] = []

            shuffled_models = models[:]
            random.shuffle(shuffled_models)
            task_title_model_mapping[task_id] = {}

            for i, model in enumerate(shuffled_models):
                model_trans_key = f"{model}_{target_language}"
                if model_trans_key in item:
                    translation = copy.deepcopy(translation_template)
                    translation['output'] = item[model_trans_key]
                    translation['model'] = titles[i]
                    task['models'].append(translation)
                    task_title_model_mapping[task_id][titles[i]] = model
                else:
                    print(f"{model_trans_key} not found in data entry {data_idx}")

            tasks.append(task)

        batch_tasks['tasks'] = tasks

        # === Construct folder path and file names ===
        lang_direction = f"{source_language}-{target_language}"
        model_folder = f"{num_models}models"
        folder_path = f"../dataset/tasks/mt/{dataset_name}/{lang_direction}/{model_folder}"
        os.makedirs(folder_path, exist_ok=True)

        filename_prefix = f"{dataset_name}-{lang_direction}-{model_folder}"
        output_file = f"{folder_path}/{filename_prefix}-{str(batch_number).zfill(2)}.json"
        mapping_file = f"{folder_path}/{filename_prefix}-{str(batch_number).zfill(2)}-model-mapping.json"

        save_json(batch_tasks, output_file)
        save_json(task_title_model_mapping, mapping_file)

        print(f"✅ Saved batch {batch_number} to {output_file}")
        batch_number += 1

# ------------------ Example Usage ------------------

# models = ['lesan', 'google', 'nllb']
# models = ['lesan', 'google', 'gemini_2_0', 'nl
models = ['lesan', 'google']

src_file = "../dataset/translations/MIMIC-en-am.json"
source_language = 'eng'
target_language = "amh"
dataset_name = "MIMIC"
dataset_domain = "Health"

generate_multiple_batches(
    src_file=src_file,
    dataset_name=dataset_name,
    dataset_domain=dataset_domain,
    source_language=source_language,
    target_language=target_language,
    models=models,
    batch_size=25
)
