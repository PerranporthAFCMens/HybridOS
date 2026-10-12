# Owners and admins can set their own working hours (12 October 2026)

**The problem.** The owner could not schedule a class with themselves on it. Scheduling checks that everyone on the class is inside
their working hours (and holds any qualification the class needs), and an owner has no working hours: the Staff screen showed
no Edit button for owners and admins ("managed under Owners and admins"), so there was nowhere to set them.

**What changed.** On Settings, Staff, an owner or admin now shows their working-hours line ("Working hours not set" until set),
their qualifications, and a button, **Hours and qualifications**. It opens a short form with only the weekly hours and the
qualifications. It does not show, and does not write, their role, access level, job title or pay, and there is still no Remove for
an owner or admin (their access stays under Owners and admins). Staff and coaches are edited exactly as before.

**Database.** No change. Owners and admins were already allowed to write `staff_working_hours` and `staff_capabilities`
(policies "owners admins manage working hours" and "owners admins manage staff capabilities"), and the class check already reads
those tables for whoever is on the class. Saving refreshes the class screens' staff and rules so the next class uses the new hours.

**Until then / other routes.** A class can still be scheduled despite a failed check with the existing override (a reason is kept).

**Not done.** Setting a different class-day rule for owners (for example, "owners are always available"). That would change the
scheduling rule itself and needs a decision.
