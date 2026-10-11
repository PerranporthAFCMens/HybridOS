// Run a browser check as if it were another day: `FAKE_DAYS=3 node --import ./browser/fake-date.mjs browser/classes.mjs`.
// Shifts the clock of the script itself; mock.mjs sets the same clock in the page. Used to catch checks that only pass on some days of the week.
const days = Number(process.env.FAKE_DAYS ?? 0);
const hours = Number(process.env.FAKE_HOURS ?? 0);
const shift = days * 86400000 + hours * 3600000;
if (shift) {
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + shift);
      else super(...args);
    }
    static now() { return RealDate.now() + shift; }
  }
  globalThis.Date = ShiftedDate;
}
