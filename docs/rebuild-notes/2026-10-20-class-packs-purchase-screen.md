# Class packs part 2b-3: Buy button on the member Classes screen

Screen only. Stripe sandbox only. Works only after the 2b-1 SQL is run and the 2b-2 functions are deployed (see `2026-10-20-class-packs-purchase-payment.md`). Test gym: Puffin Performance.

- A "Class packs" card at the bottom of the member Classes screen lists the packs on sale (classes, price per class, how long it lasts) with a Buy button each. It appears only when the gym takes card payments and has at least one pack on sale; otherwise members see nothing new.
- Buy asks the server to set up a one-off payment, then shows the exact agreement words and Stripe's own card form (the card number never reaches this app). Nothing is charged until the member ticks the agreement and presses Pay.
- After Stripe takes the money, the server is asked to confirm with Stripe and only then adds the pack; if that is slow the member is told to check back rather than pay again. The pack count on the screen refreshes.
- Files: `web/src/data/packBuy.ts`, `web/src/member/BuyPacks.tsx`, `web/src/member/MemberClasses.tsx`, `web/src/member/member.css`, `web/browser/member-pack-buy.mjs`.
- Checks: `member-pack-buy.mjs` (cards on and off, phone and desktop, declined card, no pack claimed until confirmed).
