export type ChallengeCategory = 'strength' | 'endurance' | 'power' | 'mobility' | 'composition';

export type IconKey =
  | 'pushup'
  | 'dips'
  | 'pullup'
  | 'muscleup'
  | 'barbell'
  | 'barbell-up'
  | 'dumbbell'
  | 'squat'
  | 'barbell-squat'
  | 'deadlift'
  | 'pistol'
  | 'plank'
  | 'run'
  | 'heart'
  | 'swim'
  | 'sprint'
  | 'jumplong'
  | 'jumpup'
  | 'jumprope'
  | 'bridge'
  | 'ruler';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: IconKey;
  category: ChallengeCategory;
}
