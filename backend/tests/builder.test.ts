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
