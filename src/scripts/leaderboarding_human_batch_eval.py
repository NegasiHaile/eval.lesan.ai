from collections import defaultdict
from datetime import datetime
import numpy as np
import json

def add_models_name_to_the_evaluated_data(evaluated_data, real_models_name_log):
    """
    Map fake model names to real model names using real_models_name_log.
    Adds real name as `model_name` in each output, preserving the original fake name.
    """
    for task in evaluated_data["tasks"]:
        task_id = task["id"]
        mapping = real_models_name_log.get(task_id, {})
        for output in task["models"]:
            fake_name = output["model"]
            real_name = mapping.get(fake_name)
            output["model_name"] = real_name  # Add real model name
    return evaluated_data

def group_eval_of_the_same_model(evaluated_data):
    """
    Groups evaluation models by real model name.
    """
    grouped = defaultdict(list)
    for task in evaluated_data["tasks"]:
        for output in task["models"]:
            model_name = output.get("model_name")
            if model_name:
                grouped[model_name].append(output)
    return grouped

def caculate_mean_sd_of_rating(grouped_data, model_metadata={}):
    """
    Calculates average and standard deviation for both rating and ranking.
    """
    stats = {}
    for model, entries in grouped_data.items():
        ratings = [e["rate"] for e in entries]
        ranks = [e.get("rank", 0) for e in entries]

        stats[model] = {
            "rate_avg": round(np.mean(ratings), 2),
            "rate_sd": round(np.std(ratings), 2),
            "rank_avg": round(np.mean(ranks), 2),
            "rank_sd": round(np.std(ranks), 2),
            "votes": len(ratings),
            "organization": model_metadata.get(model, {}).get("organization", "Unknown"),
            "license": model_metadata.get(model, {}).get("license", "Unknown"),
        }
    return stats

def generate_ranking_of_models(stats):
    """
    Ranks models based on rank mean, then rank SD, then rating mean, then rating SD.
    """
    models = [{"model": model, **data} for model, data in stats.items()]
    models.sort(key=lambda x: (x["rank_avg"], x["rank_sd"], -x["rate_avg"], x["rate_sd"]))

    ranked = []
    current_rank = 1
    for i, model in enumerate(models):
        if i > 0:
            prev = models[i - 1]
            if (
                model["rank_avg"] == prev["rank_avg"]
                and model["rank_sd"] == prev["rank_sd"]
                and model["rate_avg"] == prev["rate_avg"]
                and model["rate_sd"] == prev["rate_sd"]
            ):
                model["rank"] = ranked[-1]["rank"]
            else:
                model["rank"] = current_rank
        else:
            model["rank"] = current_rank
        ranked.append(model)
        current_rank += 1

    return ranked

def generate_leaderboard(evaluated_data, real_models_name_log, model_metadata):
    """
    Full pipeline to generate a leaderboard from evaluated data and real model name mappings.
    """
    updated_data = add_models_name_to_the_evaluated_data(evaluated_data, real_models_name_log)
    grouped = group_eval_of_the_same_model(updated_data)
    stats = caculate_mean_sd_of_rating(grouped, model_metadata)
    ranked_models = generate_ranking_of_models(stats)

    leaderboard = {
        "type": "auto",
        "batch_id": evaluated_data['batch_id'],
        "updated_at": datetime.now().strftime("%d-%m-%Y"),
        "total_votes": sum(len(task["models"]) for task in updated_data["tasks"]),
        "dataset_name": evaluated_data['dataset_name'],
        "dataset_domain": evaluated_data['dataset_domain'],
        "source_language": evaluated_data['source_language'],
        "trg_lang": evaluated_data['target_language'],
        "models": ranked_models
    }

    return leaderboard


# Example data
eavaluated_data_with_fake_modelname_path = '../data/eval/Abenezer-HornMT-eng-amh_1749199361299_9992_batch_tasks.json'

real_models_name_log = '../data/tasks/Abenezer-HornMT-eng-amh-15-tasks-2-models-model-mapping.json'

with open(eavaluated_data_with_fake_modelname_path, 'r', encoding="utf-8") as f:
    eavaluated_data_with_fake_modelname = json.load(f)

with open(real_models_name_log, 'r', encoding="utf-8") as f:
    real_models_name_log = json.load(f)


model_metadata = {
    "google": {"organization": "Google", "license": "proprietary"},
    "lesan": {"organization": "LesanAI", "license": "proprietary"}
}

leaderboard = generate_leaderboard(
    eavaluated_data_with_fake_modelname,
    real_models_name_log,
    model_metadata
)

import json
print(json.dumps(leaderboard, indent=2, ensure_ascii=False))

