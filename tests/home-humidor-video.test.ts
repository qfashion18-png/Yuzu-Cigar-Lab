import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const homePageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const humidorDemoVideoUrl = new URL("../src/components/humidor-demo-video.tsx", import.meta.url);
const humidorDemoVideoSource = existsSync(humidorDemoVideoUrl)
  ? readFileSync(humidorDemoVideoUrl, "utf8")
  : "";

test("home page renders the digital humidor explainer video", () => {
  const section = homePageSource.indexOf('data-home-humidor-video="explainer"');
  const component = homePageSource.indexOf("<HumidorDemoVideo");
  const video = humidorDemoVideoSource.indexOf('aria-label="Yuzu digital humidor explainer video"');
  const source = humidorDemoVideoSource.indexOf('src="/assets/digital-humidor-explainer.mp4"');
  const poster = humidorDemoVideoSource.indexOf('poster="/refs/humidor.png"');

  assert.ok(section >= 0, "missing homepage humidor video section");
  assert.ok(component > section, "homepage video section should render HumidorDemoVideo");
  assert.ok(video >= 0, "humidor video should include an accessible video label");
  assert.ok(source > video, "humidor video should use the rendered explainer asset");
  assert.ok(poster > video, "humidor video should include the humidor poster image");
});
