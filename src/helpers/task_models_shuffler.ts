import { EvalTaskTypes } from "@/types/data";

// Generate labels like A, B, ..., Z, AA, AB, etc.
function generateLabels(n: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    let label = "";
    let num = i;
    do {
      label = String.fromCharCode((num % 26) + 65) + label;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    labels.push(label);
  }
  return labels;
}

// Seeded shuffle using Fisher-Yates + Mulberry32 RNG
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Mulberry32 PRNG
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple hash to convert string to numeric seed
function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ✅ Exported function
export function shuffleAndAnonymizeModels(
  tasks: EvalTaskTypes[],
  seed = 42
): {
  anonymized_tasks: EvalTaskTypes[];
  task_models_shuffles: Record<string, Record<string, string>>;
} {
  const task_models_shuffles: Record<string, Record<string, string>> = {};

  tasks.forEach((task) => {
    const labels = generateLabels(task.models.length);
    const taskSeed = hashStringToSeed(task.id + seed.toString());
    const shuffled = seededShuffle(task.models, taskSeed);

    const labelMap: Record<string, string> = {};

    for (let i = 0; i < shuffled.length; i++) {
      const label = labels[i];
      labelMap[label] = shuffled[i].model;

      // Replace the model name with the anonymized label
      task.models[i] = {
        ...shuffled[i],
        model: label,
      };
    }

    task_models_shuffles[task.id] = labelMap;
  });

  return {
    anonymized_tasks: tasks,
    task_models_shuffles,
  };
}
