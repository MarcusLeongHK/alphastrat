# Browser Preview Testing

Use this skill when verifying UI changes in the browser preview pane.

## Clicking Elements Reliably

1. **Always use `read_page` with `filter: interactive` first** to get element refs
2. **Click via `ref`** (e.g., `left_click` with `ref: "ref_42"`), never by guessing coordinates
3. If `read_page` doesn't show the element, use `filter: all` with a focused `ref_id` or increase `max_chars`
4. If the element isn't interactive (table rows with onClick), use `find` to locate it, or read the page tree to get its ref and click via ref

## Expanding Watchlist Rows

The watchlist table rows use `onClick` on `<tr>` elements — they appear as `generic` in the page tree, not as buttons. To expand a ticker:
1. `read_page` with `filter: all`
2. Find the `generic "TICKER"` ref (e.g., `generic "NVDA" [ref_73]`)
3. Click via that ref

## Testing Flow

1. `read_page` interactive → get refs
2. Click via ref → action
3. `wait` 2-5s for async data (API calls, AI generation)
4. `screenshot` or `read_page` → verify result
5. `read_console_messages` with `onlyErrors: true` → check for errors

## Tab Navigation

- Use `read_page` interactive to find tab buttons (Overview, News, Sentiment)
- Click the button ref directly
- Wait for async content to load before verifying

## Fresh Testing (no stale state)

- Open a new tab with `tabs_create` for a clean console
- Navigate to the page with `navigate`
- Console errors from previous tabs/sessions will NOT carry over
