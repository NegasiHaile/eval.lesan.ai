import { EvalTaskTypes } from "@/types/data";

export const validateEvaluationTask = (
  task: EvalTaskTypes
): { isValid: boolean; message?: string; errorTitles?: string[] } => {
  const models = task.models;

  const unratedTitles = models
    .filter((o) => typeof o.rate !== "number" || o.rate <= 0)
    .map((o) => o.model);

  if (unratedTitles.length > 0) {
    return {
      isValid: false,
      message: "All translations must be rated (rate > 0).",
      errorTitles: unratedTitles,
    };
  }

  const unrankedTitles = models
    .filter((o) => typeof o.rank !== "number" || o.rank <= 0)
    .map((o) => o.model);

  if (unrankedTitles.length > 0) {
    return {
      isValid: false,
      message: "All translations must be ranked (rank > 0).",
      errorTitles: unrankedTitles,
    };
  }

  const seenRanks = new Set<number>();
  const duplicateRankTitles: string[] = [];

  models.forEach((o) => {
    if (seenRanks.has(o.rank)) {
      duplicateRankTitles.push(o.model);
    } else {
      seenRanks.add(o.rank);
    }
  });

  if (duplicateRankTitles.length > 0) {
    return {
      isValid: false,
      message: "Each translation must have a unique rank.",
      errorTitles: duplicateRankTitles,
    };
  }

  // Check consistency: higher rating should have better (lower) rank
  const rankMismatchTitles: string[] = [];

  for (let i = 0; i < models.length; i++) {
    for (let j = 0; j < models.length; j++) {
      if (
        i !== j &&
        models[i].rate > models[j].rate &&
        models[i].rank > models[j].rank &&
        !rankMismatchTitles.includes(models[i].model)
      ) {
        rankMismatchTitles.push(models[i].model);
      }
    }
  }

  if (rankMismatchTitles.length > 0) {
    return {
      isValid: false,
      message:
        "Ranking must reflect rating: higher-rated translations should have better (lower) ranks.",
      errorTitles: rankMismatchTitles,
    };
  }

  return { isValid: true };
};
