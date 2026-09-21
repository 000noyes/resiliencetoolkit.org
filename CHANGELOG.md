# Changelog

Notable changes to ResilienceToolkit.org. Versions have three parts from
0.1.0 onward; earlier releases used four.

## [0.1.1] - 2026-09-16

A patch release for phones. Text sizes are consistent now, and nothing runs
off the side of the screen. Nothing new to learn.

### Changed
- Text sizes now match across the whole site. Page titles are smaller on a
  phone and larger on a desktop. The /modules index uses them too. It was the
  one page left out in 0.1.0.
- A chapter now opens with its title on a phone. The order is breadcrumb,
  title, View PDF and See Additional Resources in one row, On this page, then
  the chapter.
- On this page now shows the chapter's sections on a phone and nothing finer.
  Subsections come back on wider screens. It no longer appears on a chapter
  with one heading.
- Nothing on a phone is smaller than 12px. Every label now meets the contrast
  standard in light and dark.
- A tablet at 768px no longer gets the phone rules and the desktop rules at
  once. Turning a phone sideways with a sheet open now closes the sheet and
  returns you to the page.

### Fixed
- Fixed horizontal scrolling at 375px. Long links wrap, code blocks scroll in
  their own box, the outside-link notice fits, and each button in the bottom
  bar fits on one line.
- Fixed sideways scrolling on 0.1, the Emergency Preparedness opener, and
  About.

### For contributors
- Every route is now checked at 320, 375 and 414 wide.

## [0.1.0] - 2026-09-15

### Added
- The home page is now the cover of the toolkit. The full contents sit on it
  section by section, and the introduction reads as the front matter.
- Every chapter now opens with the contents on the left and On this page on
  the right. Both close to a labelled button and reopen from it, and your
  choice stays on this device. The article is the same width either way.
- Each chapter's citation to the printed toolkit now sits under Footnotes. A
  chapter whose printed page number is not yet confirmed shows a note instead.
- One search box now sits in the header on every page. Results group by
  chapter and open on the words you searched for, which stay highlighted. The
  full results page at /search reopens from its address and from the back
  button. Search works offline.
- On phones, the contents and Footnotes now sit in a bar at the bottom that
  opens a sheet.
- The Community Needs Assessment, the Interactive Toolkit Activity and the
  Vermont Town Directory now appear beside 0.1 in every contents list, marked
  as outside links.
- Printing a chapter now leaves out the navigation and prints the citation.
- The site now counts page visits on its own server, recording the page and
  the time. Nothing about you is kept, and one page is never linked to the
  next. Returning readers are served from the offline copy, so they are not
  counted.

### Changed
- The header now stays in place, so typing in the search box no longer scrolls
  the page.
- The storage card on a chapter now appears only after you have saved work on
  the device. A first visit shows the chapter, not a backup prompt.
- The old sidebar, drawer and floating button are gone.
- The /modules index is unchanged.

### Fixed
- Fixed the search sheet zooming the page on iPhone when you type.
- Fixed Start here showing one Knowing Your Community activity instead of all
  three.
- Fixed a search result landing on the section opener, which had no heading to
  land on. A result now opens the chapter itself.
- Fixed the endless wait when storage does not respond. After ten seconds the
  page shows a message and a Retry button. Some browsers never respond at all.
- Fixed Toolkit Contents and Footnotes sitting left with a gap in the phone
  bar. They are spaced evenly now.

## [0.0.15.0] - 2026-07-24

### Added
- The corner button now opens a small panel. Questions has the message form,
  and Fund this work shows the two ways to give, online or a check with
  Toolkit in the memo.
- A workshop copy of the site can now be built for review sessions. Every page
  in it is labelled as a copy, search engines skip it, and it is always served
  fresh.
- Review rounds are a page reached only by a direct link. A group can tap a
  spot, leave a numbered note, read each other's notes, and pick the
  conversation up at the next meeting. Notes are kept if a save fails, and the
  page prints cleanly.

### Changed
- Nothing else on the finished site changed.

## [0.0.14.0] - 2026-07-18

### Added
- The dashboard now opens with one fact, whether the work on this device is
  backed up. Below that, a table shows what is saved here, module by module.
- Restoring now shows a preview first, and nothing changes until you say so.
  If the file is missing newer work, you are asked to back up this device
  first, and told exactly what replacing would remove.
- A backup file is named with the date, and with the device name when one is
  set. Inside, a sentence tells whoever finds it where it goes.
- A printable recovery card at /recovery-card, in words that can be read aloud
  over the phone.
- On phones that support it, you can now send a backup straight to a device
  you own.

### Changed
- One set of words everywhere. You back up your work, and you restore it from
  a backup file.
- The storage reminder now depends on your work rather than the calendar. It
  appears only when you have unprotected work, and backing up clears it.
- The streak and goal card is gone. Keeping work safe is not a game, and a
  broken streak is a bad thing to see after a hard week.
- Notices now appear one at a time instead of stacking. The storage reminders
  were rewritten and link straight to the one-tap backup.

### Fixed
- Fixed untouched modules counting as started. Blank prompts used to count
  toward Modules Started. Saved answers are unchanged.
- Fixed devices stuck on a broken mid-July copy. They are repaired on the next
  visit, with no action needed and no effect on saved answers.
- Fixed a rare unstyled-page flash around updates. A wrong response is no
  longer kept, and it clears on the next load.
- Fixed unknown addresses loading the home page. They now show a
  page-not-found message.
- Fixed returning visitors seeing weeks-old pages.
- Fixed a precached page you had never opened failing to render offline.

### Removed
- Third-party analytics and trackers. The site makes no cross-origin requests,
  and a test checks this on every change.

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
- The source-fidelity verifier now checks SlotCollection pages. No change on
  the site.

## [0.0.11.1] - 2026-05-18

### Changed
- The Pod Mapping Worksheet is now one download rather than split between the
  page and a PDF. The essay, the instructions and the diagrams were written to
  be read together. The download link on the page is unchanged.

## [0.0.11.0] - 2026-05-10

### Added
- Knowing Your Community now includes the full BATJC Pod Mapping Worksheet
  from the workbook, not only the short setup. The longer framing written by
  the Bay Area Transformative Justice Collective was missing.

### Changed
- Updates now arrive silently. A new version takes effect on your next visit.
  The old prompt appeared on nearly every visit and gave no sign of what had
  changed.
- The footer now shows the date of the last update.

### For contributors
- The source verifier can now flag places where the workbook has structure the
  site flattened. Those places stay recorded until they are restored.

## [0.0.10] - 2026-05-03

### Changed
- Every module page has been checked against the workbook, line by line. About
  134 drifted titles, reworded prompts, substituted links and dropped
  sentences were restored to the workbook wording or removed. Nothing was
  removed without a record.
- Knowing Your Community is back in the workbook's eleven-section order, with
  the full agenda, facilitation guides, readiness checklist and pod-mapping
  prose restored.
- Chapter introductions match the workbook again.
- An out-of-date April webinar notice is gone from the home page.
- Six pages no longer repeat the resources folder link in the body. The button
  on every section page still links to it. Two workbook typos in the old line
  went with it.

### Added
- Pages with no headings now show a Top of page entry in the sidebar, and the
  column no longer collapses.
- Directory templates on 1-9 for neighbors and first responders.

### Fixed
- Fixed the sidebar collapsing the page column on four module pages.

### For contributors
- Verification now runs before every build and on every push, so a page that
  has drifted from the workbook cannot be shipped.
- Every removed item is preserved in an archive file with its workbook
  reference and the commit that removed it.

## [0.0.9] - 2026-04-21

### Added
- Every field, label and column on the site can now be traced to a page in the
  workbook or an official template, and drift is caught before it is shipped.

### For contributors
- PlanForm component for single-record forms. 294 new tests. Verification runs
  in CI.

## [0.0.8] - 2026-04-13

### Fixed
- Fixed search on the home page, which had been hidden since an earlier
  simplification. Only module pages are indexed, so results are content, not
  navigation.
- Fixed a failed search leaving Searching on screen.

## [0.0.7] - 2026-04-13

### Added
- Tables became cards on phones and stayed tables on wider screens, with a
  save indicator, CSV export and keyboard navigation.
- A journal layout for longer written answers, with a completion count and an
  export made for printing and passing round at a meeting.
- Three directory templates on 1-9: leaders, neighbors, first responders.

### Changed
- Knowing Your Community and 1-9 moved onto the new tables. Existing answers
  carried over.

## [0.0.6] - 2026-04-05

### For contributors
- Thirteen unused components removed or set aside. No change on the site.

## [0.0.5] - 2026-03-29

### Fixed
- **Offline mode was silently broken for everyone.** The list of pages to save
  for offline use included addresses that no longer existed, and one wrong
  address stopped the whole list from saving. Anyone who believed they had
  offline access did not have it. The list is now built from the site on every
  release, so it cannot fall out of date, and one bad address no longer stops
  the rest.

### Changed
- The README now leads with what the toolkit is for.

## [0.0.4] - 2026-03-28

### Changed
- Home page photographs were held back pending a content review.
- The dashboard's Module 1 link now points at the module instead of a broken
  address.

### Removed
- The changelog link was taken out of the footer until this file is current.

## [0.0.3] - 2026-03-28

### Added
- A new page at /replicate explains how another community can stand up its own
  Resilience Hub.
- Importing your data is now all-or-nothing, so a crash part way through
  cannot leave it half written.
- The export button now shows when you last exported.

### Fixed
- A skip-to-content link for keyboard and screen reader users.
- Tap targets are at least 44px.
- Fixed the page shifting when you check a box.

### Changed
- Deployment moved to Cloudflare Pages.

### For contributors
- The content system and its build steps were removed. Pages are plain files.

## [0.0.2] - 2026-03-27

### Added
- Sections 1.9 and 1.10 now have checkboxes. They were read-only before.
- You can now page from the end of Module 1 into Module 2 without jumping back
  to the index.

### Fixed
- Fixed external links erroring on first load. They work as plain links until
  the page is ready, then activate.

---

Work before this, from November 2025, built the site and its modules and moved
it onto Cloudflare Pages. That history is in the commits rather than here.
