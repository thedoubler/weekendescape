export type WeekendStyle = "strict" | "frimon" | "loose";

export interface WeekendParams {
  flyDays: number[];
  retFlyDays: number[];
  nightsFrom: number;
  nightsTo: number;
}

export function weekendStyleToParams(style: WeekendStyle): WeekendParams {
  switch (style) {
    case "strict":
      return { flyDays: [6], retFlyDays: [0], nightsFrom: 1, nightsTo: 1 };
    case "frimon":
      return { flyDays: [5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 3 };
    case "loose":
      return { flyDays: [4, 5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 4 };
    default:
      throw new Error(`Unknown weekend style: ${style}`);
  }
}
