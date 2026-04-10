import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAdminNotificationSource } from "./notification-event-source";

test("normalizeAdminNotificationSource keeps task metadata and drops empty source", () => {
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
      taskId: "task-child-1",
      sourceType: "consultation",
      sourceId: "consult-1",
      relatedTaskIds: ["task-child-1", "task-child-1"],
    }),
    {
      institutionName: "SmartChildcare",
      workflow: "daily-priority",
      relatedChildIds: ["child-1"],
      relatedClassNames: ["向日葵班"],
      consultationId: "consult-1",
      relatedConsultationIds: ["consult-1"],
      taskId: "task-child-1",
      sourceType: "consultation",
      sourceId: "consult-1",
      relatedTaskIds: ["task-child-1"],
    }
  );
});
