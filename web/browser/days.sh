#!/bin/sh
# Run the date-sensitive browser checks as if it were each day of the week (and a few hours of the day).
# Usage: sh browser/days.sh [days...]   e.g. sh browser/days.sh 0 1 2 3 4 5 6
cd "$(dirname "$0")/.." || exit 1
DAYS="${*:-0 1 2 3 4 5 6}"
CHECKS="today members classes classes-calendar member train membership reports reports-drill reports-library builder community workouts"
bad=0
for d in $DAYS; do
  for c in $CHECKS; do
    if ! FAKE_DAYS="$d" node --import ./browser/fake-date.mjs "browser/$c.mjs" > /tmp/days-$$.out 2>&1; then
      echo "FAIL +${d} days: $c"; grep -E "FAIL" /tmp/days-$$.out | head -3; bad=1
    fi
  done
  echo "done +${d} days"
done
exit $bad
