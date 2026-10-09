// The exercise list the classic app offers as you type (the same 264 names), plus the rules for matching and for
// guessing what to record: a hold is timed, a run, row, ski, bike or swim is distance, anything else weight and reps.
import type { Tracking } from './calc';

export const ACTIVITIES: string[] = ["Ab Wheel Rollout", "Air Bike", "Air Squat", "Arnold Press", "Assault Bike", "Back Extension", "Back Squat", "Band Pull Apart", "Band Row", "Barbell Bench Press", "Barbell Bulgarian Split Squat", "Barbell Clean", "Barbell Curl", "Barbell Front Raise", "Barbell Glute Bridge", "Barbell Good Morning", "Barbell Hack Squat", "Barbell Hip Thrust", "Barbell Lunge", "Barbell Overhead Press", "Barbell Row", "Barbell Shrug", "Barbell Split Squat", "Barbell Step Up", "Barbell Thruster", "Bear Crawl", "Bench Dip", "Bench Press", "Bent Over Row", "Bicep Curl", "Bird Dog", "Box Jump", "Box Step Over", "Box Step Up", "Broad Jump", "Bulgarian Split Squat", "Burpee", "Burpee Broad Jump", "Burpee Box Jump Over", "Butterfly Pull-Up", "Cable Chest Fly", "Cable Crossover", "Cable Curl", "Cable Face Pull", "Cable Fly", "Cable Front Raise", "Cable Kickback", "Cable Lateral Raise", "Cable Pullover", "Cable Row", "Cable Tricep Extension", "Calf Raise", "Chest Press", "Chest Supported Row", "Chin-Up", "Clean", "Clean and Jerk", "Clean Pull", "Close Grip Bench Press", "Concept2 BikeErg", "Concept2 RowErg", "Concept2 SkiErg", "Cossack Squat", "Crunch", "Cycling", "Dead Bug", "Dead Hang", "Deadlift", "Decline Bench Press", "Decline Push-Up", "Deficit Deadlift", "Diamond Push-Up", "Dip", "Double Under", "Dumbbell Bench Press", "Dumbbell Bulgarian Split Squat", "Dumbbell Clean", "Dumbbell Curl", "Dumbbell Deadlift", "Dumbbell Floor Press", "Dumbbell Front Raise", "Dumbbell Goblet Squat", "Dumbbell Hammer Curl", "Dumbbell Hip Thrust", "Dumbbell Incline Bench Press", "Dumbbell Lateral Raise", "Dumbbell Lunge", "Dumbbell Overhead Press", "Dumbbell Pullover", "Dumbbell Rear Delt Fly", "Dumbbell Romanian Deadlift", "Dumbbell Row", "Dumbbell Shoulder Press", "Dumbbell Shrug", "Dumbbell Snatch", "Dumbbell Split Squat", "Dumbbell Step Up", "Dumbbell Thruster", "Dumbbell Tricep Extension", "Elliptical", "EZ Bar Curl", "Face Pull", "Farmers Carry", "Farmers Walk", "Floor Press", "Flutter Kick", "Front Squat", "Front Rack Lunge", "Front Raise", "Glute Bridge", "Goblet Squat", "Good Morning", "GHD Sit-Up", "Hack Squat", "Hammer Curl", "Handstand Hold", "Handstand Push-Up", "Hang Clean", "Hang Power Clean", "Hang Power Snatch", "Hang Snatch", "Hanging Knee Raise", "Hanging Leg Raise", "High Pull", "Hip Abduction", "Hip Adduction", "Hip Thrust", "Hollow Hold", "Hollow Rock", "HYROX Burpee Broad Jump", "HYROX Farmers Carry", "HYROX Row", "HYROX Sandbag Lunges", "HYROX SkiErg", "HYROX Sled Pull", "HYROX Sled Push", "HYROX Wall Balls", "Incline Barbell Bench Press", "Incline Dumbbell Bench Press", "Incline Push-Up", "Inverted Row", "Jefferson Curl", "Jump Rope", "Jump Squat", "Kettlebell Clean", "Kettlebell Deadlift", "Kettlebell Goblet Squat", "Kettlebell Press", "Kettlebell Row", "Kettlebell Snatch", "Kettlebell Swing", "Kettlebell Turkish Get-Up", "Kipping Pull-Up", "Knee Raise", "Lat Pulldown", "Lateral Lunge", "Lateral Raise", "Leg Curl", "Leg Extension", "Leg Press", "Leg Raise", "Lunge", "Machine Chest Press", "Machine Row", "Man Maker", "Medicine Ball Clean", "Medicine Ball Slam", "Mountain Climber", "Muscle-Up", "Nordic Hamstring Curl", "Overhead Carry", "Overhead Press", "Overhead Squat", "Pallof Press", "Pendlay Row", "Pistol Squat", "Plank", "Power Clean", "Power Snatch", "Preacher Curl", "Pull-Up", "Push Jerk", "Push Press", "Push-Up", "Rack Pull", "Rear Delt Fly", "Renegade Row", "Reverse Crunch", "Reverse Fly", "Reverse Lunge", "Romanian Deadlift", "Rope Climb", "Rope Pull", "Rowing", "Run 100 m", "Run 200 m", "Run 400 m", "Run 800 m", "Run 1 km", "Run 1 Mile", "Run 5K", "Run 10K", "Running", "Sandbag Carry", "Sandbag Clean", "Sandbag Front Squat", "Sandbag Lunge", "Sandbag Over Shoulder", "Sandbag Shoulder Carry", "Seated Cable Row", "Seated Leg Curl", "Seated Row", "Shoulder Press", "Side Plank", "Single Arm Dumbbell Row", "Single Arm Kettlebell Press", "Single Leg Deadlift", "Single Leg Romanian Deadlift", "Single Under", "Sissy Squat", "SkiErg", "Sled Drag", "Sled Pull", "Sled Push", "Smith Machine Bench Press", "Smith Machine Squat", "Snatch", "Snatch Pull", "Split Jerk", "Split Squat", "Sprint", "Stair Climber", "Step Up", "Strict Press", "Strict Pull-Up", "Sumo Deadlift", "Sumo Squat", "Swimming", "T Bar Row", "Tempo Run", "Thruster", "Toes to Bar", "Trap Bar Deadlift", "Tricep Dip", "Tricep Extension", "Turkish Get-Up", "Upright Row", "V-Up", "Walking Lunge", "Wall Ball", "Wall Sit", "Weighted Dip", "Weighted Pull-Up", "Windmill", "Yoke Carry", "Yoga", "Pilates", "Mobility Session", "Stretching", "Foam Rolling", "Zone 2 Bike", "Zone 2 Row", "Zone 2 Run", "Zone 2 SkiErg"];

const CARDIO = /\b(run|running|jog|row|rowing|ski|skierg|rowerg|bikeerg|bike|biking|cycle|cycling|swim|swimming|walk|walking|hike|sprint|erg|assault|treadmill|mile|5k|10k|parkrun|half marathon|marathon)\b/i;
const HOLD = /\b(plank|hold|hang|wall sit|l-sit|farmer|carry|dead hang|bridge)\b/i;

export function guessTracking(name: string): Tracking {
  const n = name.trim();
  if (HOLD.test(n) && !CARDIO.test(n)) return 'time';
  if (CARDIO.test(n)) return 'distance';
  return 'strength';
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function rank(query: string, item: string): number {
  const q = normalise(query);
  const n = normalise(item);
  if (!q) return 2;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(' ').some((w) => w.startsWith(q))) return 2;
  if (n.includes(q)) return 3;
  return 99;
}

/** Names that fit what has been typed: the member's own exercises first, then the list; best match first. */
export function matchExercises(query: string, own: string[] = [], limit = 8): string[] {
  const q = normalise(query);
  if (!q) return [];
  const seen = new Set<string>();
  const items: { name: string; r: number; own: boolean }[] = [];
  for (const [list, isOwn] of [[own, true], [ACTIVITIES, false]] as const) {
    for (const name of list) {
      const key = normalise(name);
      if (seen.has(key)) continue;
      const r = rank(query, name);
      if (r >= 99) continue;
      seen.add(key);
      items.push({ name, r, own: isOwn });
    }
  }
  return items.sort((a, b) => a.r - b.r || Number(b.own) - Number(a.own) || a.name.localeCompare(b.name)).slice(0, limit).map((x) => x.name);
}
