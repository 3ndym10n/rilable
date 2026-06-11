import assert from "node:assert/strict";
import test from "node:test";

import { renderPocTemplate } from "../convex/builder";

test("POC template renders parseable static app files without external LLM", () => {
  const output = renderPocTemplate("Build this web app: <script>alert('x')</script> habit tracker");

  assert.match(output, /^APP_NAME:/m);
  assert.match(output, /^APP_EMOJI: ⚡$/m);
  assert.match(output, /===FILE: index\.html===/);
  assert.match(output, /===FILE: style\.css===/);
  assert.match(output, /===FILE: app\.js===/);
  assert.match(output, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt; habit tracker/);
  assert.doesNotMatch(output, /<script>alert\('x'\)<\/script>/);
});

test("ProjectOps/P6-style prompts render a stateful schedule dashboard instead of a generic shell", () => {
  const output = renderPocTemplate(
    "Build a project dashboard app that tracks Virgil active projects with a P6-style schedule view, dependencies, risks, blockers, owners, and next actions"
  );

  assert.match(output, /^APP_NAME: ProjectOps$/m);
  assert.match(output, /^APP_EMOJI: 📊$/m);
  assert.match(output, /P6-style schedule/i);
  assert.match(output, /dependencies/i);
  assert.match(output, /blockers/i);
  assert.match(output, /risks/i);
  assert.match(output, /owner/i);
  assert.match(output, /next action/i);
  assert.match(output, /localStorage\.setItem\('forge-projectops-projects'/);
  assert.match(output, /function renderTimeline/);
  assert.match(output, /function addProject/);
  assert.match(output, /<form id="project-form"/);
  assert.match(output, /data-view="timeline"/);
});
