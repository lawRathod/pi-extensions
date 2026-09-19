// Local-patch contract for extensions/pi-goal/index.ts.
//
// Upstream ships the abort handling on an unmerged branch (fix/pause-on-escape,
// commit 3078686). We carry it as a local patch, so this test is the tripwire:
// if an upstream update drops or reworks it, this fails instead of silently
// letting escape-aborted turns resume the goal.
//
// Run: bun test extensions/pi-goal/test/abort-pauses.test.cjs

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const indexSource = readFileSync(join(__dirname, "../index.ts"), "utf8");

test("aborted turns pause the goal instead of queueing another continuation", () => {
	// turn_end detects the abort and flips the goal to paused (usage still charged).
	assert.match(indexSource, /message\?\.stopReason === "aborted"/);
	assert.match(indexSource, /aborted \? \{ \.\.\.accounted, status: "paused"/);
	// The LLM learns about the pause on its next invocation; nothing is triggered.
	assert.match(indexSource, /emitGoalEvent\(pi, "paused", next, \{ deliverAs: "nextTurn" \}\)/);
	// agent_end must not re-queue a continuation for a paused goal.
	assert.match(indexSource, /goal\.status !== "active" \|\| ctx\.hasPendingMessages\(\)/);
});
