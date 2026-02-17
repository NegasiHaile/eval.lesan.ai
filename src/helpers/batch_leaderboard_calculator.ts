import { EvalTaskTypes } from "@/types/data";

type ModelStatsOBSOLETED = {
  model: string;
  avg_rank: number;
  avg_rate: number;
  overall_rank: number;
};

type ModelStats = {
  model: string;
  rank: Record<string, number>; // e.g., { "1st": 10, "2nd": 5, ... }
  rate: Record<string, number>; // e.g., { "1": 12, "2": 8, ... }
  avg_rank: number;
  avg_rate: number;
  overall_rank: number;
};

export function calculateLeaderboard(
  evaluatedTasks: EvalTaskTypes[],
  taskModelShuffles?: Record<string, Record<string, string>>
): ModelStats[] {
  const modelStats: Record<
    string,
    {
      rank: Record<string, number>;
      rate: Record<string, number>;
      totalRank: number;
      totalRate: number;
      count: number;
    }
  > = {};

  for (const task of evaluatedTasks) {
    const shuffleMap = taskModelShuffles?.[task.id];

    for (const model of task.models) {
      const originalName = shuffleMap ? shuffleMap[model.model] : model.model;
      if (!originalName) continue;

      if (!modelStats[originalName]) {
        modelStats[originalName] = {
          rank: {},
          rate: {},
          totalRank: 0,
          totalRate: 0,
          count: 0,
        };
      }

      const stats = modelStats[originalName];

      // Rank count
      if (model.rank !== undefined) {
        const key = String(model.rank);
        stats.rank[key] = (stats.rank[key] ?? 0) + 1;
        stats.totalRank += model.rank;
      }

      // Rate count
      if (model.rate !== undefined) {
        const key = String(model.rate);
        stats.rate[key] = (stats.rate[key] ?? 0) + 1;
        stats.totalRate += model.rate;
      }

      stats.count += 1;
    }
  }

  const leaderboard: ModelStats[] = Object.entries(modelStats).map(
    ([model, stats]) => ({
      model,
      rank: stats.rank,
      rate: stats.rate,
      avg_rank: +(stats.totalRank / stats.count).toFixed(3),
      avg_rate: +(stats.totalRate / stats.count).toFixed(3),
      overall_rank: 0,
    })
  );

  // Sort Olympic-style: more 1st, then 2nd..., then rate fallback
  leaderboard.sort((a, b) => {
    for (let i = 1; i <= 10; i++) {
      const key = String(i);
      const aVal = a.rank[key] ?? 0;
      const bVal = b.rank[key] ?? 0;
      if (aVal !== bVal) return bVal - aVal; // More 1st wins
    }

    // Fallback: use rate (higher ratings are better)
    for (let i = 5; i >= 1; i--) {
      const key = String(i);
      const aVal = a.rate[key] ?? 0;
      const bVal = b.rate[key] ?? 0;
      if (aVal !== bVal) return bVal - aVal;
    }

    // Final fallback: avg_rate descending
    return b.avg_rate - a.avg_rate;
  });

  // Assign overall ranks (with tie handling)
  let currentRank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    const prev = leaderboard[i - 1];
    const curr = leaderboard[i];

    const isSameAsPrevious =
      i > 0 &&
      JSON.stringify(curr.rank) === JSON.stringify(prev.rank) &&
      JSON.stringify(curr.rate) === JSON.stringify(prev.rate);

    curr.overall_rank = isSameAsPrevious ? prev.overall_rank : currentRank;
    currentRank++;
  }

  return leaderboard;
}

export function calculateLeaderboardOBSOLETED(
  evaluatedTasks: EvalTaskTypes[],
  taskModelShuffles?: Record<string, Record<string, string>>
): ModelStatsOBSOLETED[] {
  const modelStats: Record<
    string,
    { totalRank: number; totalRate: number; model_count: number }
  > = {};

  for (const task of evaluatedTasks) {
    const shuffleMap = taskModelShuffles?.[task.id];

    for (const model of task.models) {
      // If shuffleMap exists, de-anonymize. Otherwise, use the model name directly.
      const originalName = shuffleMap ? shuffleMap[model.model] : model.model;
      if (!originalName) continue;

      if (!modelStats[originalName]) {
        modelStats[originalName] = {
          totalRank: 0,
          totalRate: 0,
          model_count: 0,
        };
      }

      modelStats[originalName].totalRank += model.rank ?? 0;
      modelStats[originalName].totalRate += model.rate ?? 0;
      modelStats[originalName].model_count += 1;
    }
  }

  const leaderboard = Object.entries(modelStats).map(([model, stats]) => ({
    model,
    avg_rank: stats.totalRank / stats.model_count,
    avg_rate: stats.totalRate / stats.model_count,
    overall_rank: 0, // to be set below
  }));

  // Sort: lower avg_rank first, then higher avg_rate
  leaderboard.sort((a, b) => {
    if (a.avg_rank !== b.avg_rank) return a.avg_rank - b.avg_rank;
    return b.avg_rate - a.avg_rate;
  });

  // Assign overall_rank with tie-handling
  let currentRank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    if (
      i > 0 &&
      leaderboard[i].avg_rank === leaderboard[i - 1].avg_rank &&
      leaderboard[i].avg_rate === leaderboard[i - 1].avg_rate
    ) {
      leaderboard[i].overall_rank = leaderboard[i - 1].overall_rank;
    } else {
      leaderboard[i].overall_rank = currentRank;
    }
    currentRank++;
  }

  return leaderboard;
}

// 🏆 Leaderboard Calculation Logic
// After model evaluations are completed (with ranks and ratings), the system calculates a leaderboard to compare model performance across all tasks.

// ✅ Step-by-Step Logic:
// De-anonymization of Models
// Each task initially anonymizes model names using shuffled labels. Before calculating leaderboard metrics, these labels are mapped back to the original model names using the task_models_shuffles data.

// Aggregate Evaluation Scores
// For each model:

// Sum up all rank values across tasks

// Sum up all rate values across tasks

// Count the number of evaluations

// Compute Averages
// For every model:

// Average Rank = totalRank / number of tasks
// (Lower is better)

// Average Rate = totalRate / number of tasks
// (Higher is better)

// Sort Models
// Models are sorted:

// First by ascending average rank

// Then by descending average rate (to break ties on rank)

// Assign Overall Rank
// Final leaderboard ranks are assigned using competition ranking:

// Models with identical avg_rank and avg_rate receive the same overall rank

// The next rank skips accordingly (e.g., ranks: 1, 2, 2, 4...)

// 💡 Example Output
// [
//   { model: "lesan", avg_rank: 1.5, avg_rate: 3.5, overall_rank: 1 },
//   { model: "google", avg_rank: 2.0, avg_rate: 3.0, overall_rank: 2 },
//   { model: "another", avg_rank: 2.0, avg_rate: 3.0, overall_rank: 2 },
//   { model: "low", avg_rank: 3.0, avg_rate: 1.0, overall_rank: 4 },
// ];
