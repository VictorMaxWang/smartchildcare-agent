import assert from "node:assert/strict";
import test from "node:test";

import { shouldEnableAdminConsultationFeed } from "./use-admin-workspace-loader";

test("shouldEnableAdminConsultationFeed depends on visible children and not notification readiness", () => {
  assert.equal(
    shouldEnableAdminConsultationFeed({
      visibleChildrenCount: 0,
      notificationReady: false,
    }),
    false
  );

  assert.equal(
    shouldEnableAdminConsultationFeed({
      visibleChildrenCount: 2,
      notificationReady: false,
    }),
    true
  );

  assert.equal(
    shouldEnableAdminConsultationFeed({
      visibleChildrenCount: 2,
      notificationReady: true,
    }),
    true
  );
});
