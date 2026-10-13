# The new app gets the HybridOne home-screen icon and name (13 October 2026)

The HybridOne tab icon was already on every page, including the new app. What the new app (`web/index.html`) lacked, and the older pages
already had, was the phone **home-screen** setup: the web manifest (name "HybridOne", the 192/512 and maskable icons), the navy
browser-bar colour (`theme-color`) and the short name used by "Add to Home Screen" on iPhone (`apple-mobile-web-app-title`). All three
are added. The links use the same `__SITE__` placeholder as the tab icon, so they point at the right files on the live site and on the dev page.
No artwork changed. Checked: the built site's `/next/index.html` carries the three tags and the manifest file is in the built site;
built-site smoke and UI consistency checks pass.
