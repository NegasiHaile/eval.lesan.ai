import json

# Load the data from a file
with open("../data/bleu_score_metrics.json", "r") as infile:
    data = json.load(infile)

# Sort data by 'bleu' descending, then 'chrf' descending
ranked_data = sorted(data, key=lambda x: (-x["bleu"], -x["chrf"]))

# Assign rank
for i, item in enumerate(ranked_data, start=1):
    item["rank"] = i

# Save the ranked data to a new file
with open("../data/ranked_bleu_score_metrics.json", "w") as outfile:
    json.dump(ranked_data, outfile, indent=2)

print("Ranking complete. Results saved to 'ranked_output.json'.")