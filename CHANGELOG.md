# Changelog

Notable changes to ResilienceToolkit.org. Versions have three parts from
0.1.0 onward; earlier releases used four.

## [0.1.1] - 2026-09-16

A patch release for phones. Text sizes are consistent now, and nothing runs
off the side of the screen. Nothing new to learn.

### Changed
- One set of text sizes across the whole site. Page titles are smaller on a
  phone and larger on a desktop. The /modules index joins the rest; it was
  the one page held back from the reading grammar in 0.1.0.
- A chapter opens with its title on a phone. Breadcrumb, then the title,
  then View PDF and See Additional Resources as one row of links, then On
  this page, then the chapter.
- On this page lists the chapter's sections on a phone, brings subsections
  back on wider screens, and does not appear on a chapter with only one
  heading.
- Nothing on a phone reads smaller than 12px. Every label meets the contrast
  standard in both light and dark.
- A tablet at 768px no longer gets the phone rules and the desktop rules at
  the same time. Turning a phone sideways with a sheet open closes the
  sheet and returns you to the page.

### Fixed
- Nothing runs off the side of a 375px phone. Long links wrap, code blocks
  scroll on their own, the outside-link notice fits, and each button in the
  bottom bar holds one line.
- 0.1, the Emergency Preparedness opener, and About no longer scroll sideways.

### For contributors
- Every route is checked at 320, 375 and 414 wide.

## [0.1.0] - 2026-09-15

### Added
- The home page is the cover of the toolkit. The full contents sit on it,
  section by section, and the introduction reads as the front matter.
- Every chapter reads with the contents on the left and On this page on the
  right. Both close to a labelled button and open again from it, and the site
  remembers your choice on this device. The article keeps its width either way.
- Footnotes holds each chapter's citation to the printed toolkit. Chapters
  whose printed pages are still being checked say so.
- One search box in the header on every page. Results group by chapter and open
  on the words you searched for, which stay marked. A full results page at
  /search restores from its address and from the back button. Search works
  offline.
- On phones, the contents and Footnotes sit in a bar at the bottom that opens a
  sheet.
- The Community Needs Assessment, the Interactive Toolkit Activity and the
  Vermont Town Directory sit beside 0.1 in every contents list, marked as
  outside links.
- Printing a chapter drops the reading chrome and keeps the citation.
- The site counts how many people reach each page, on its own server. It stores
  the page and the time. Nothing about you is kept, and nothing links one page
  to the next. Returning readers are served from the offline copy, so they are
  not counted.

### Changed
- The header stays in place, so typing in the search box never scrolls the page.
- The storage card on a chapter appears only once this device holds work. A
  first visit meets the chapter, not a backup prompt.
- The old sidebar, drawer and floating button are retired.
- The /modules index is unchanged.

### Fixed
- Typing in the search sheet no longer zooms the page on iPhone.
- Start here lists all three Knowing Your Community activities. It named one.
- A search result now opens the chapter itself rather than the section opener,
  which had no heading to land on.
- If storage does not answer within ten seconds, the page says so and offers
  Retry, instead of waiting forever. Some browsers never answer at all.
- Toolkit Contents and Footnotes are spaced evenly in the phone bar. They sat
  left with a gap.

## [0.0.15.0] - 2026-07-24

### Added
- The corner button opens a small panel. Questions holds the message form.
  Fund this work shows both ways to give: online, or a check with Toolkit in
  the memo.
- The site can build a workshop copy of itself for review sessions. Every page
  there says what it is, search engines skip it, and it is always served fresh.
- Review rounds: a page reached only by a direct link, where a group can tap a
  spot and leave a numbered note, read each other's notes, and pick the
  conversation back up at the next meeting. Notes survive a failed save, and
  the page prints cleanly.

### Changed
- Nothing on the finished site changes except the corner button.

## [0.0.14.0] - 2026-07-18

### Added
- The dashboard answers one question first: whether the work on this device is
  backed up. Below that, a table of what is saved here, module by module.
- Restoring shows a preview first. Nothing changes until you say so. If the
  file is missing newer work, the dashboard offers to back this device up
  first, and says exactly what replacing would remove.
- Backup files carry the date, the device name when one is set, and a sentence
  inside telling whoever finds it where it goes.
- A printable recovery card at /recovery-card, in words that can be read aloud
  over the phone.
- On phones that support it, you can send a backup straight to a device you own.

### Changed
- One set of words everywhere: you back up your work, and you restore it from a
  backup file.
- The storage reminder now follows your work rather than the calendar. It
  appears only when unprotected work exists, and backing up quiets it.
- The streak and goal card is retired. Keeping work safe is not a game, and a
  broken streak should not greet someone returning after a hard week.
- Notices show one at a time instead of stacking. The storage reminders were
  rewritten calmer, and link straight to the one-tap backup.

### Fixed
- An untouched module no longer counts as started. Blank prompts used to count
  toward Modules Started. Saved answers are unchanged.
- Devices stuck on a broken mid-July copy now recover on their own, with no
  action needed and no effect on saved answers.
- A rare unstyled-page flash around updates. The site now refuses to keep a
  wrong response, and repairs itself on the next load.
- Unknown addresses show a page-not-found message instead of the home page.
- Returning visitors no longer see weeks-old pages.
- A page you precached but never opened now renders fully when opened offline.

### Removed
- Third-party analytics and trackers. The site makes zero cross-origin
  requests, enforced by a test that runs on every change.

## [0.0.13.0] - 2026-05-25

### Changed
- Mapping your community is back to three slots, as the workbook has it.
  Existing answers move into the first slot.

## [0.0.12.0] - 2026-05-25

### Changed
- Carpooling initiatives is back to one checkbox per action, as the workbook
  has it.

## [0.0.11.2] - 2026-05-25

### For contributors
- The source-fidelity verifier learned to check SlotCollection pages. No change
  on the site.

## [0.0.11.1] - 2026-05-18

### Changed
- The Pod Mapping Worksheet is now read as one download rather than split
  between the page and a PDF. The essay, the instructions, and the diagrams were
  written to be read together. The download link on the page is unchanged.

## [0.0.11.0] - 2026-05-10

### Added
- Knowing Your Community now carries the full BATJC Pod Mapping Worksheet from
  the workbook, not only the short setup. The longer framing the Bay Area
  Transformative Justice Collective wrote was missing.

### Changed
- Updates now land silently. A new version takes over on your next visit
  instead of interrupting you. The old update prompt fired on nearly every
  visit and never said what had changed.
- The footer shows when the site was last updated.

### For contributors
- The source verifier can now flag places where the workbook has structure the
  site flattened, and hold them in a recorded state until they are restored.

## [0.0.10] - 2026-05-03

### Changed
- Every module page has been checked against the workbook, line by line. About
  134 drifted titles, reworded prompts, substituted links and dropped sentences
  were restored to the workbook wording or removed. Nothing was removed without
  a record.
- Knowing Your Community is back in the workbook's eleven-section order, with
  the full agenda, facilitation guides, readiness checklist and pod-mapping
  prose recovered.
- Chapter introductions match the workbook again.
- An out-of-date April webinar notice is gone from the home page.
- Six pages no longer repeat the resources folder link in the body. The button
  on every section page still reaches it. Two workbook typos in the old body
  line are retired with it.

### Added
- Pages with no headings now show a Top of page entry in the sidebar instead of
  collapsing the column.
- Directory templates on 1-9 for neighbors and first responders.

### Fixed
- The sidebar no longer collapses the page column on four module pages.

### For contributors
- Verification runs before every build and on every push, so a page cannot
  drift away from the workbook and ship.
- Every removed item is preserved in an archive file with its workbook
  reference and the commit that removed it.

## [0.0.9] - 2026-04-21

### Added
- Every field, label and column on the site can now be traced to a page in the
  workbook or an official template, and drift is caught before it ships.

### For contributors
- PlanForm component for single-record forms. 294 new tests. Verification runs
  in CI.

## [0.0.8] - 2026-04-13

### Fixed
- Search works again on the home page. It had been hidden since an earlier
  simplification removed what it depended on. Only module pages are indexed, so
  results are content, not navigation.
- A failed search no longer leaves Searching on screen.

## [0.0.7] - 2026-04-13

### Added
- Tables became cards on phones and stayed tables on wider screens, with a save
  indicator, CSV export and keyboard navigation.
- A journal layout for longer written answers, with a completion count and an
  export made for printing and passing round at a meeting.
- Three directory templates on 1-9: leaders, neighbors, first responders.

### Changed
- Knowing Your Community and 1-9 moved onto the new tables. Existing answers
  carry over.

## [0.0.6] - 2026-04-05

### For contributors
- Thirteen unused components removed or set aside. No change on the site.

## [0.0.5] - 2026-03-29

### Fixed
- **Offline mode was silently broken for everyone.** The list of pages to save
  for offline use named addresses that no longer existed, and one wrong address
  stopped the whole list from saving. Anyone who believed they had offline
  access did not have it. The list is now built from the site itself on every
  release, so it cannot drift again, and one bad address no longer stops the
  rest.

### Changed
- The README leads with what the toolkit is for.

## [0.0.4] - 2026-03-28

### Changed
- Home page photographs held back pending a content review.
- The dashboard's Module 1 link points at the module instead of a broken
  address.

### Removed
- The changelog link is out of the footer until this file is current.

## [0.0.3] - 2026-03-28

### Added
- /replicate: how another community can stand up its own Resilience Hub.
- Importing your data is now all-or-nothing, so a crash part way through cannot
  leave it half written.
- The export button shows when you last exported.

### Fixed
- A skip-to-content link for keyboard and screen reader users.
- Tap targets are at least 44px.
- Checking a box no longer shifts the page.

### Changed
- Deployment moved to Cloudflare Pages.

### For contributors
- The content system and its build steps were removed; pages are plain files.

## [0.0.2] - 2026-03-27

### Added
- Sections 1.9 and 1.10 have checkboxes. They were read-only before.
- You can page from the end of Module 1 into Module 2 without jumping back to
  the index.

### Fixed
- External links no longer error on first load. They work as plain links until
  the page is ready, then activate.

---

Earlier work, from November 2025, built the site and its modules and moved it
onto Cloudflare Pages. It is recorded in the commit history rather than here.
