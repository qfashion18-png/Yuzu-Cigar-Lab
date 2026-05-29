import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  fetchHumidorDashboardBootstrap,
  fetchLivePageContent,
  fetchPublishedNewsStories,
  getLiveApiErrorMessage,
  identifyCigarFromImage,
  publishNewsStory,
  saveLivePageContent,
  sendConciergeChat,
  sendConciergeVoiceMessage,
  draftNewsStory,
  updateLiveAccountProfile,
  updateHumidorItem,
  type AccountProfileUpdateResponse,
  type CigarImageIdentifyResponse,
  type ConciergeChatResponse,
  type ConciergeVoiceResponse,
  type HumidorItemsResponse,
  type LivePageContentResponse,
  type NewsStoryDraftResponse,
  type PublishedNewsStoriesResponse,
  type PublishNewsStoryResponse,
  type SaveLivePageContentResponse,
} from "../src/lib/live-api";
import {
  getLivePageEditorConfig,
  mergeLivePageValues,
  normalizeLiveEditorPath,
} from "../src/lib/live-page-editor";

const adminConsolePageSource = readFileSync(new URL("../src/app/admin/console/page.tsx", import.meta.url), "utf8");
const siteChromeSource = readFileSync(new URL("../src/components/site-chrome.tsx", import.meta.url), "utf8");
const sectionHeadingSource = readFileSync(new URL("../src/components/section-heading.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const membershipPageSource = readFileSync(new URL("../src/app/membership/page.tsx", import.meta.url), "utf8");
const educationPageSource = readFileSync(new URL("../src/app/education/page.tsx", import.meta.url), "utf8");
const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("live page editor normalizes static-export paths and finds editable pages", () => {
  assert.equal(normalizeLiveEditorPath("/"), "/");
  assert.equal(normalizeLiveEditorPath("/membership/"), "/membership");
  assert.equal(normalizeLiveEditorPath("/education/?preview=1"), "/education");

  assert.equal(getLivePageEditorConfig("/")?.label, "Homepage");
  assert.equal(getLivePageEditorConfig("/membership/")?.label, "Membership");
  assert.equal(getLivePageEditorConfig("/education")?.label, "Education");
  assert.equal(getLivePageEditorConfig("/admin"), null);
});

test("live page editor merges saved field edits without accepting unknown keys", () => {
  const config = getLivePageEditorConfig("/");

  assert.ok(config);

  const values = mergeLivePageValues(config, {
    "home.hero.title": "Edited live homepage headline",
    "unknown.field": "Do not render this",
  });

  assert.equal(values["home.hero.title"], "Edited live homepage headline");
  assert.equal(values["unknown.field"], undefined);
  assert.equal(values["home.hero.primaryCta"], "Shop Boxes");
});

test("website editor is removed from admin navigation and public chrome owns live editing", () => {
  assert.equal(adminConsolePageSource.includes("Website Editor"), false);
  assert.equal(adminConsolePageSource.includes("YuzuAdminConsole"), false);
  assert.ok(siteChromeSource.includes("LivePageEditor"), "site chrome should mount the live page editor for signed-in admins");
});

test("public chrome owns the always-on concierge and its voice controls", () => {
  const floatingConciergeSource = readFileSync(new URL("../src/components/floating-concierge.tsx", import.meta.url), "utf8");
  const sheetSource = readFileSync(new URL("../src/components/ui/sheet.tsx", import.meta.url), "utf8");

  assert.ok(siteChromeSource.includes("FloatingConcierge"), "site chrome should mount the sitewide concierge widget");
  assert.ok(floatingConciergeSource.includes('"fixed right-4 z-[45]"'), "concierge should stay fixed in the lower-right corner");
  assert.ok(floatingConciergeSource.includes(' : "bottom-4"'), "non-cart pages should keep the normal lower-right concierge position");
  assert.ok(floatingConciergeSource.includes('pathname.startsWith("/cart")'), "cart routes should offset the concierge above the mobile checkout bar");
  assert.ok(floatingConciergeSource.includes("bottom-[calc(6.25rem+env(safe-area-inset-bottom))]"), "mobile cart checkout controls should not be covered by the concierge launcher");
  assert.ok(floatingConciergeSource.includes("lg:bottom-4"), "desktop pages should keep the normal lower-right concierge position");
  assert.ok(floatingConciergeSource.includes("z-[45]"), "concierge should sit above ordinary page chrome");
  assert.ok(sheetSource.includes("fixed z-50"), "active sheets should render above the floating concierge");
  assert.equal(floatingConciergeSource.includes("z-[90]"), false, "concierge should not overlay active navigation sheets");
  assert.ok(floatingConciergeSource.includes("MediaRecorder"), "voice messages should record browser microphone audio");
  assert.ok(floatingConciergeSource.includes("SpeechRecognition"), "voice messages should capture a transcript hint when available");
  assert.ok(floatingConciergeSource.includes("sendConciergeVoiceMessage"), "voice messages should use the live voice API helper");
  assert.ok(floatingConciergeSource.includes("voiceOutput: voiceEnabled"), "text replies should be able to request spoken audio");
  assert.ok(floatingConciergeSource.includes("Yuzu Concierge AI"), "the visible widget should present one concierge AI surface");
  assert.equal(floatingConciergeSource.includes("conciergeModes"), false, "specialist mode buttons should not render in the widget");
  assert.equal(floatingConciergeSource.includes("setMode"), false, "the widget should not maintain a manually selected specialist mode");
  assert.equal(floatingConciergeSource.includes("agent: mode"), false, "the widget should let the backend Lex router choose the agent");
  assert.equal(floatingConciergeSource.includes("cigar_guide"), false, "cigar guide should not be exposed as a UI mode");
  assert.equal(packageSource.includes("amazon-chime-sdk"), false, "speech input/output should not depend on Amazon Chime SDK");
});

test("public pages expose editable hooks for admin live editing", () => {
  assert.ok(homePageSource.includes('data-yuzu-editable="home.hero.title"'));
  assert.ok(homePageSource.includes('data-yuzu-editable="home.hero.copy"'));
  assert.ok(sectionHeadingSource.includes("data-yuzu-editable={editableIds?.title}"));
  assert.ok(sectionHeadingSource.includes("data-yuzu-editable={editableIds?.copy}"));
  assert.ok(membershipPageSource.includes('title: "membership.hero.title"'));
  assert.ok(membershipPageSource.includes('copy: "membership.hero.copy"'));
  assert.ok(educationPageSource.includes('data-yuzu-editable="education.hero.title"'));
  assert.ok(educationPageSource.includes('data-yuzu-editable="education.featured.title"'));
});

test("live page API client reads public content and publishes admin edits", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload =
      calls.length === 1
        ? ({
            page: {
              route: "/",
              edits: { "home.hero.title": "Published from Lambda" },
              updatedAt: "2026-05-08T10:00:00.000Z",
            },
            persistence: "stored",
          } satisfies LivePageContentResponse)
        : ({
            page: {
              route: "/",
              edits: { "home.hero.title": "Admin headline" },
              updatedAt: "2026-05-08T10:05:00.000Z",
            },
            persistence: { status: "stored", table: "site_page_content" },
          } satisfies SaveLivePageContentResponse);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const loaded = await fetchLivePageContent("/");
    const saved = await saveLivePageContent(
      "/",
      { "home.hero.title": "Admin headline" },
      { Authorization: "Bearer admin-token" }
    );

    assert.equal(loaded.page.edits["home.hero.title"], "Published from Lambda");
    assert.equal(saved.persistence.table, "site_page_content");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/content/pages?route=%2F");
    assert.equal(calls[0].init?.method, "GET");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, undefined);
    assert.equal(calls[1].url, "https://api.yuzucigarclub.test/content/pages");
    assert.equal(calls[1].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      route: "/",
      edits: { "home.hero.title": "Admin headline" },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client sends authenticated concierge chat requests", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload = {
      conversation: {
        id: "conv-live",
        persisted: true,
        persistence: "stored",
      },
      agent: "YCCCigarGuide",
      ai: { status: "bedrock_agent_runtime" },
      reply: "A Connecticut shade wrapper is a balanced morning pairing.",
      input: {
        accepted: true,
        length: 47,
      },
      guardrails: {
        ageRestricted: true,
        piiMinimized: true,
        tobaccoHealthClaims: "not_provided",
        humanHandoff: false,
      },
      nextActions: ["review_operator_handoffs"],
    } satisfies ConciergeChatResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await sendConciergeChat(
      {
        message: "What wrapper pairs well with a morning cigar?",
        agent: "cigar_guide",
        conversationId: "conv-live",
      },
      { Authorization: "Bearer member-token" }
    );

    assert.equal(response.agent, "YCCCigarGuide");
    assert.match(response.reply, /Connecticut shade/);
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/concierge/chat");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer member-token");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      message: "What wrapper pairs well with a morning cigar?",
      agent: "cigar_guide",
      conversationId: "conv-live",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client patches authenticated account profile updates", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const shippingAddress = {
    address1: "111 W Boston St",
    address2: "Suite 5",
    city: "Chandler",
    state: "AZ",
    postalCode: "85225",
    country: "US",
  };

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload = {
      account: {
        email: "member@yuzucigarclub.example",
        name: "Member Two",
        groups: ["member", "sensei"],
      },
      profile: {
        phone: "4805552121",
        shippingAddress,
      },
      source: "cognito-jwt",
      database: {
        persisted: true,
        persistence: "stored",
        table: "member_profiles",
        memberId: "11111111-1111-4111-8111-111111111111",
      },
    } satisfies AccountProfileUpdateResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await updateLiveAccountProfile(
      {
        name: "Member Two",
        phone: "4805552121",
        shippingAddress,
      },
      { Authorization: "Bearer member-token" }
    );

    assert.equal(response.account.name, "Member Two");
    assert.equal(response.profile.shippingAddress.postalCode, "85225");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/account/me");
    assert.equal(calls[0].init?.method, "PATCH");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer member-token");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      name: "Member Two",
      phone: "4805552121",
      shippingAddress,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client retries transient browser fetch failures once", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  let callCount = 0;

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async () => {
    callCount += 1;

    if (callCount === 1) {
      throw new TypeError("Failed to fetch");
    }

    const payload = {
      conversation: {
        id: "conv-retry",
        persisted: false,
        persistence: "pending",
      },
      agent: "YCCAdminAgent",
      ai: { status: "fallback" },
      reply: "Admin backend is reachable.",
      input: {
        accepted: true,
        length: 29,
      },
      guardrails: {
        ageRestricted: true,
        piiMinimized: true,
        tobaccoHealthClaims: "not_provided",
        humanHandoff: false,
      },
      nextActions: [],
    } satisfies ConciergeChatResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await sendConciergeChat({ message: "Check admin backend", agent: "admin" }, { Authorization: "Bearer admin-token" });

    assert.equal(response.reply, "Admin backend is reachable.");
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client explains persistent browser network failures", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  let callCount = 0;

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async () => {
    callCount += 1;
    throw new TypeError("Failed to fetch");
  };

  try {
    await assert.rejects(
      () => sendConciergeChat({ message: "Check humidor agent reachability", agent: "humidor" }, { Authorization: "Bearer member-token" }),
      (error) => {
        assert.equal(getLiveApiErrorMessage(error), "The live Yuzu API could not be reached from this site. Try again once the API route and CORS access are available.");
        return true;
      }
    );
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client sends authenticated concierge voice messages", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload = {
      conversation: {
        id: "conv-voice",
        persisted: true,
        persistence: "stored",
      },
      agent: "YCCHumidorAgent",
      ai: { status: "bedrock_runtime" },
      reply: "Keep the desktop humidor near 69 percent RH.",
      input: {
        accepted: true,
        length: 37,
      },
      voice: {
        inputAudio: {
          accepted: true,
          mimeType: "audio/webm",
          bytes: 12,
          durationMs: 2100,
        },
        transcription: {
          service: "amazon_transcribe",
          status: "completed",
          transcript: "Track the humidity in my desktop humidor",
        },
        speech: {
          service: "amazon_polly",
          status: "synthesized",
          mimeType: "audio/mpeg",
          audioBase64: "ZmFrZS1tcDM=",
          voiceId: "Joanna",
        },
      },
      guardrails: {
        ageRestricted: true,
        piiMinimized: true,
        tobaccoHealthClaims: "not_provided",
        humanHandoff: false,
      },
      nextActions: ["review_operator_handoffs"],
    } satisfies ConciergeVoiceResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await sendConciergeVoiceMessage(
      {
        audioBase64: "ZmFrZS12b2ljZQ==",
        mimeType: "audio/webm",
        transcriptHint: "Track the humidity in my desktop humidor",
        durationMs: 2100,
        agent: "humidor",
        conversationId: "conv-voice",
      },
      { Authorization: "Bearer member-token" }
    );

    assert.equal(response.voice.transcription.service, "amazon_transcribe");
    assert.equal(response.voice.speech.service, "amazon_polly");
    assert.match(response.reply, /69 percent RH/);
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/concierge/voice");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer member-token");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      audioBase64: "ZmFrZS12b2ljZQ==",
      mimeType: "audio/webm",
      transcriptHint: "Track the humidity in my desktop humidor",
      durationMs: 2100,
      agent: "humidor",
      conversationId: "conv-voice",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client sends authenticated cigar image identification requests", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload = {
      suggestion: {
        name: "Padron 1964 Anniversary Toro",
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        wrapper: "Nicaraguan",
        origin: "Nicaragua",
        strength: "Full",
        quantity: 1,
        purchaseDate: null,
        agingStartDate: null,
        reorderReminder: null,
        humidorLocation: "",
        tray: "",
        rating: null,
        tastingNotes: "Band and box label appear to show Padron 1964 Anniversary.",
        source: "ai_cigar_image",
        confidence: "medium",
        evidence: ["Band text resembles Padron 1964 Anniversary"],
        needsReview: ["Confirm vitola before saving"],
        details: {
          manufacturer: "Padrón Cigars",
          country: "Nicaragua",
          region: "Estelí",
          factory: "Tabacos Cubanica",
          size: "6 x 52",
          length: "6 in",
          ringGauge: "52",
          shape: "Toro",
          wrapper: "Nicaraguan",
          binder: "Nicaraguan",
          filler: "Nicaraguan",
          blend: "All-Nicaraguan tobacco",
          flavorProfile: ["cocoa", "espresso", "pepper"],
          body: "Full",
          finish: "Long cocoa and pepper finish",
          msrp: "Varies by retailer",
          releaseStatus: "Regular production",
          packaging: "Box-pressed anniversary line",
          sourceSummary: "Known Padron 1964 Anniversary reference details inferred after visual identification.",
          imageObservations: ["Brown Padron band"],
        },
      },
      ai: {
        status: "bedrock_runtime",
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      },
      input: {
        accepted: true,
        imageType: "image/jpeg",
        imageBytes: 12,
        notesLength: 13,
      },
      guardrails: {
        ageRestricted: true,
        piiMinimized: true,
        tobaccoHealthClaims: "not_provided",
        humanHandoff: false,
      },
      nextActions: ["review_identified_fields", "confirm_add_to_humidor"],
    } satisfies CigarImageIdentifyResponse;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await identifyCigarFromImage(
      {
        imageBase64: "ZmFrZS1pbWFnZQ==",
        mimeType: "image/jpeg",
        notes: "band closeup",
      },
      { Authorization: "Bearer member-token" }
    );

    assert.equal(response.suggestion.brand, "Padron");
    assert.equal(response.suggestion.source, "ai_cigar_image");
    assert.equal(response.suggestion.details.manufacturer, "Padrón Cigars");
    assert.deepEqual(response.suggestion.details.flavorProfile, ["cocoa", "espresso", "pepper"]);
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/humidor/identify-cigar");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer member-token");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      imageBase64: "ZmFrZS1pbWFnZQ==",
      mimeType: "image/jpeg",
      notes: "band closeup",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client keeps humidor inventory when alert preferences fail", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    const requestUrl = String(url);
    calls.push({ url: requestUrl, init });

    if (requestUrl.endsWith("/humidor/items")) {
      const payload = {
        items: [
          {
            id: "humidor-1",
            name: "Padron 1964 Anniversary Toro",
            brand: "Padron",
            line: "1964 Anniversary",
            vitola: "Toro",
            wrapper: "Nicaraguan",
            origin: "Nicaragua",
            strength: "Full",
            quantity: 2,
            rating: 94,
            purchaseDate: "2026-03-12",
            agingStartDate: "2026-03-12",
            reorderReminder: "2026-06-15",
            humidorLocation: "Locker A",
            tray: "Drawer 2",
            tastingNotes: "Cocoa and cedar.",
            source: "member_humidor",
            estimatedValue: 18.5,
            estimatedValueCurrency: "USD",
            estimatedValueSource: "member_estimate",
            cigarImage: null,
            createdAt: "2026-05-08T10:00:00.000Z",
          },
        ],
        persistence: "stored",
      } satisfies HumidorItemsResponse;

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.endsWith("/humidor/smokes")) {
      return new Response(JSON.stringify({ logs: [], persistence: "stored" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      message: "Internal Server Error",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const response = await fetchHumidorDashboardBootstrap({ Authorization: "Bearer member-token" });

    assert.equal(response.items.items.length, 1);
    assert.equal(response.items.items[0].name, "Padron 1964 Anniversary Toro");
    assert.equal(response.items.persistence, "stored");
    assert.equal(response.alerts, null);
    assert.equal(response.alertsError, "The live Yuzu API is temporarily unavailable.");
    const itemsCall = calls.find((call) => call.url === "https://api.yuzucigarclub.test/humidor/items");
    const smokesCall = calls.find((call) => call.url === "https://api.yuzucigarclub.test/humidor/smokes");
    const alertsCall = calls.find((call) => call.url === "https://api.yuzucigarclub.test/humidor/alerts");
    assert.ok(itemsCall, "bootstrap should request humidor inventory");
    assert.ok(smokesCall, "bootstrap should request recent smoke logs");
    assert.ok(alertsCall, "bootstrap should request alert preferences");
    assert.equal((itemsCall.init?.headers as Record<string, string>).Authorization, "Bearer member-token");
    assert.equal((alertsCall.init?.headers as Record<string, string>).Authorization, "Bearer member-token");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client maps empty API Gateway 401 responses to Cognito session recovery", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async () =>
    new Response("", {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      () => fetchHumidorDashboardBootstrap({ Authorization: "Bearer expired-token" }),
      (error) => {
        assert.equal(getLiveApiErrorMessage(error), "Your Cognito session expired. Please sign in again.");
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client patches a saved humidor item location", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const itemId = "abababab-abab-4bab-8bab-abababababab";

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    return new Response(
      JSON.stringify({
        item: {
          id: itemId,
          name: "Padron 1964 Anniversary Toro",
          brand: "Padron",
          line: "1964 Anniversary",
          vitola: "Toro",
          wrapper: "Nicaraguan",
          origin: "Nicaragua",
          strength: "Full",
          quantity: 2,
          rating: null,
          purchaseDate: "2026-03-12",
          agingStartDate: "2026-03-12",
          productionDate: null,
          reorderReminder: null,
          humidorLocation: "Locker B / Top Shelf",
          tray: "",
          tastingNotes: "",
          source: "member_humidor",
          estimatedValue: null,
          estimatedValueCurrency: "",
          estimatedValueSource: "",
          cigarImage: null,
          createdAt: "2026-05-08T10:00:00.000Z",
        },
        persistence: { status: "stored", table: "humidor_items" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const response = await updateHumidorItem(itemId, { humidorLocation: "Locker B / Top Shelf" }, { Authorization: "Bearer member-token" });

    assert.equal(response.item.humidorLocation, "Locker B / Top Shelf");
    assert.equal(calls[0].url, `https://api.yuzucigarclub.test/humidor/items/${itemId}`);
    assert.equal(calls[0].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { humidorLocation: "Locker B / Top Shelf" });
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer member-token");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("live API client drafts, publishes, and reads newsroom stories through Lambda", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payloads = [
      {
        draft: {
          title: "Rocky Patel Updates Its Release Calendar",
          dek: "A concise official-source update for adult cigar readers.",
          category: "Industry News",
          bodyMarkdown:
            "## What changed\nRocky Patel shared release timing through its official news channel.",
          sections: [{ heading: "What changed", body: "Rocky Patel shared release timing through its official news channel." }],
          sourceNotes: [
            {
              label: "Rocky Patel",
              url: "https://www.rockypatel.com/cigar-news/sixty-release/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          publishStatus: "draft",
          operatorReviewRequired: true,
          complianceReview: {
            ageRestricted: true,
            humanApprovalRequired: true,
            sourceVerificationRequired: true,
            prohibitedClaims: ["health"],
            prohibitedInputs: ["third-party article rewrite"],
          },
        },
        ai: { status: "bedrock_agent_runtime" },
        prompt: { acceptedSourceCount: 1, blockedSourceCount: 0 },
      } satisfies NewsStoryDraftResponse,
      {
        story: {
          slug: "rocky-patel-updates-its-release-calendar",
          title: "Rocky Patel Updates Its Release Calendar",
          dek: "A concise official-source update for adult cigar readers.",
          category: "Industry News",
          bodyMarkdown: "## What changed\nRocky Patel shared release timing through its official news channel.",
          sourceNotes: [
            {
              label: "Rocky Patel",
              url: "https://www.rockypatel.com/cigar-news/sixty-release/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          officialSources: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
          status: "published",
          publishedAt: "2026-05-11T19:00:00.000Z",
          updatedAt: "2026-05-11T19:00:00.000Z",
        },
        persistence: { status: "stored", table: "news_stories" },
      } satisfies PublishNewsStoryResponse,
      {
        stories: [
          {
            slug: "rocky-patel-updates-its-release-calendar",
            title: "Rocky Patel Updates Its Release Calendar",
            dek: "A concise official-source update for adult cigar readers.",
            category: "Industry News",
            bodyMarkdown: "## What changed\nRocky Patel shared release timing through its official news channel.",
            sourceNotes: [
              {
                label: "Rocky Patel",
                url: "https://www.rockypatel.com/cigar-news/sixty-release/",
                note: "Official brand page.",
                sourceType: "official",
              },
            ],
            officialSources: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
            status: "published",
            publishedAt: "2026-05-11T19:00:00.000Z",
            updatedAt: "2026-05-11T19:00:00.000Z",
          },
        ],
        persistence: "stored",
      } satisfies PublishedNewsStoriesResponse,
    ];

    return new Response(JSON.stringify(payloads[calls.length - 1]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const draft = await draftNewsStory(
      {
        angle: "Rocky Patel official release update",
        timeframe: "this week",
        sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
        sourceNotes: ["Official Rocky Patel page confirms release timing."],
      },
      { Authorization: "Bearer admin-token" }
    );
    const published = await publishNewsStory(
      {
        ...draft.draft,
        operatorApproved: true,
      },
      { Authorization: "Bearer admin-token" }
    );
    const stories = await fetchPublishedNewsStories(6);

    assert.equal(draft.draft.operatorReviewRequired, true);
    assert.equal(published.persistence.table, "news_stories");
    assert.equal(stories.stories[0].sourceNotes[0].sourceType, "official");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/news/story-drafts");
    assert.equal(calls[1].url, "https://api.yuzucigarclub.test/news/stories");
    assert.equal(calls[2].url, "https://api.yuzucigarclub.test/news/stories?limit=6");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer admin-token");
    assert.equal((calls[2].init?.headers as Record<string, string>).Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});
