# Explained changes

A pixel diff says where an image changed. It does not say why. Diffra records what was on the page when each snapshot was taken, compares the two sides of a change, and says which change in the page accounts for the changed pixels.

## What is recorded

For each browser snapshot, Diffra keeps a render ledger:

* Every visible element, with its position in the document, tag, id, classes and its own text.
* The element's box, in the pixel space of the screenshot.
* A fixed set of computed visual styles: spacing, size, borders, colors, typography, layout and effects.
* The stylesheet rules that match the element and set one of those styles, with the stylesheet they came from.
* The font families that were loaded.

A page with more than 800 visible elements is cut off, and the ledger says so. Ledgers are stored under the hash of the image, so an image that is approved already has its ledger stored. Turn recording off with `agent: { context: false }`.

## What an explanation says

An explanation lists causes. A cause is an element whose style or text changed, an element that appeared or disappeared, or an element that moved or changed size with no change of its own.

* **Changes**: each changed style with its value before and after.
* **Source**: the stylesheet and selector in the candidate that set the changed style. When Diffra can see which files differ from the baseline commit, the source also says whether that file changed in this branch.
* **Displaced elements**: elements that moved or resized because of the cause are counted against it instead of being reported as separate changes. A parent that grew because of its child's padding is a consequence, not a second cause.
* **Regions**: each changed region of the diff is matched to the causes whose elements it covers. A region with no cause is not accounted for by the page, which points to an image, a canvas or a rendering difference.

A size that no stylesheet rule sets is treated as an effect of layout, not a cause, because it changes whenever anything around it does.

## How sure it is

A cause is marked `attributed` when a change in the page lines up with the changed pixels. That is strong evidence, but it has not been shown to produce them. A cause could still be a coincidence of two changes in the same area, or an inline style that no stylesheet rule shows. Treat the explanation as where to look first, and confirm by looking at the changed region, or test it: [proof](proof.md) undoes the cause in the live page and marks it `proven` when that restores the baseline.

## Reading it

* In the review interface, a single sentence under the snapshot title.
* In `report.json`, as `explanation` on the result, with the ledgers named in `ledgers`.
* Through MCP, as `why` in `diffra_list_changes` and in full from `diffra_explain`.

## Limits

* Only browser captures are explained. Image and Figma drivers have no page.
* A baseline has a ledger only if it was approved from a run that recorded one. Until then a changed snapshot has no explanation.
* Styles set by script on an element, or inline, appear as changes without a source.
* The source is a stylesheet, not a line number. A built or bundled stylesheet names the built file.
