# Parent Trend Smoke

## Scope

This note is for T11.5 only: parent trend smoke, page-level verification, and a recordable demo path.

It does not change the T10 backend contract. It does not claim that fallback data is real data.

## Prerequisites

1. Start Next.js on `http://localhost:3000`.
2. Start FastAPI brain and make sure `BRAIN_API_BASE_URL` points to it.
3. Use demo accounts only. Do not place real `VIVO_APP_ID` or `VIVO_APP_KEY` in code, docs, logs, or screenshots.

Suggested local commands:

```bash
npm run dev
py -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

If your backend uses a different port, keep `BRAIN_API_BASE_URL` aligned with that port.

## Automatic Smoke

### Trend smoke

```bash
npm run ai:smoke:trend
```

What it verifies:

- The request goes through Next route `/api/ai/parent-trend-query`
- Demo login works through `/api/auth/demo-login`
- Success path returns `series`, `trendLabel`, `explanation`, `dataQuality`, `warnings`
- Fallback path returns `source=demo_snapshot` and `dataQuality.fallbackUsed=true`
- Fallback path does not pretend to be a high-quality improving trend

### Existing AI smoke

```bash
npm run ai:smoke
```

This now uses `/api/auth/demo-login` as well.

## Real Demo Path

Use this path when backend is reachable and you want a live demo:

1. Open `/login`
2. Log in with demo parent account `u-parent`
3. Enter `/parent`
4. Tap the trend / follow-up entry into `/parent/agent?child=c-1`
5. On the parent agent page, tap these trend quick questions:
   - `最近一个月分离焦虑缓解了吗？`
   - `这周饮食情况有改善吗？`
   - `最近睡眠情况更稳定了吗？`

Expected on screen:

- The asked question
- `trendLabel`
- window badge such as `7 天` / `14 天` / `30 天`
- `source`
- fallback badge when applicable
- `dataQuality`
- `warnings`
- chart, empty state, insufficient-data state, or error state

## Debug Page Cases

Use this path when you need deterministic page-level verification or fallback recording:

Base path:

```text
/parent/agent?child=c-1&trace=debug
```

Cases:

- Loading: `/parent/agent?child=c-1&trace=debug&trendCase=loading`
- Success: `/parent/agent?child=c-1&trace=debug&trendCase=success`
- Fallback: `/parent/agent?child=c-1&trace=debug&trendCase=fallback`
- Insufficient: `/parent/agent?child=c-1&trace=debug&trendCase=insufficient`
- Empty: `/parent/agent?child=c-1&trace=debug&trendCase=empty`
- Error: `/parent/agent?child=c-1&trace=debug&trendCase=error`

The page includes a QA panel with links for the 6 cases.

## Manual Checklist

### Loading

- Trend card is visible
- Chart area shows loading skeleton
- No fake result is shown yet

### Success

- `source=request_snapshot`
- `fallback` badge is absent
- `dataQuality.fallbackUsed=false`
- Chart renders with real plotted points
- `warnings` section is still visible

### Fallback

- `source=demo_snapshot`
- `fallback` badge is visible
- `dataQuality.fallbackUsed=true`
- `warnings` are visible
- The page does not show an improving trend as if it were high-quality real data

### Insufficient

- Request succeeds
- Trend card shows explanation and `dataQuality`
- Chart shows insufficient-data state instead of pretending to have a full trend line

### Empty

- Result structure still renders
- Chart area explicitly shows empty state

### Error

- Trend card shows query failure
- Retry action is visible

## Fallback Narration

Use this wording during recording:

- `source=demo_snapshot` means the result is coming from a demo snapshot, not real institution data.
- `dataQuality.fallbackUsed=true` means the frontend must label the result as fallback.
- `warnings` and `dataQuality` stay visible so the audience can see the quality boundary.
- When data is missing, the system shows insufficient-data or empty state instead of fabricating a trend.

## Recording Checklist

Keep these fields inside the recording frame:

- question
- `trendLabel`
- window badge
- `source`
- fallback badge when present
- `dataQuality`
- `warnings`
- chart or the corresponding state message

## Verification Boundary

Automatic verification covers:

- lint
- build
- backend pytest
- trend smoke script

Manual verification still covers:

- page-level appearance
- actual recording flow
- narration of fallback honesty
