import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAdminNotificationSource } from "./notification-events";

test("normalizeAdminNotificationSource keeps valid consultation binding and drops empty source", () => {
  assert.equal(normalizeAdminNotificationSource(undefined), null);
  assert.equal(normalizeAdminNotificationSource({ relatedChildIds: ["", "  "] }), null);

  assert.deepEqual(
    normalizeAdminNotificationSource({
      institutionName: "SmartChildcare",
      workflow: "daily-priority",
      relatedChildIds: ["child-1", "", "child-1"],
      relatedClassNames: ["向日葵班", ""],
      consultationId: "consult-1",
      relatedConsultationIds: ["consult-1", "consult-1"],
    }),
    {
      institutionName: "SmartChildcare",
      workflow: "daily-priority",
      relatedChildIds: ["child-1"],
      relatedClassNames: ["向日葵班"],
      consultationId: "consult-1",
      relatedConsultationIds: ["consult-1"],
    }
  );
});
