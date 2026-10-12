# Simple workout builder, and one set of boxes for coach and member

**What changed.** The coach's builder is now a name and a list of exercises. Each exercise has the same set boxes the
member fills in (reps and kg, or time, distance, calories), picked from the same exercise list. What the coach types
lands in the member's boxes: "As set" puts the coach's numbers in the empty boxes so it is one tap and Save.

**Notes.** Each exercise has a note from the coach (shown to the member as "Coach: ...") and a note from the member
("Your note", for how it felt). They are two labelled lines, so neither can overwrite the other. The member's note
travels with the finished workout and the coach sees it when reviewing.

**What went from the screen.** Workout type, focus tags, estimated minutes, visibility, blocks, block formats and
rounds. Nothing was removed from the database: new workouts get one plain block called "Workout", type "custom", and
"Staff only"; existing workouts keep their blocks, type, tags and minutes and still save them back.

**Stored shape.** The set boxes are saved inside the activity's existing `prescription` JSON as
`{ display, sets: [{ reps, weight, ... }] }`. `display` is worked out from the sets ("3 sets: 8 × 60 kg"). Workouts
built earlier have only the wording; it is kept until the coach fills in sets. No database change.

**Not done yet.** Comparing what was done with the numbers set (the 2.5% weight tolerance) is the next piece; the
numbers are now there to compare.
