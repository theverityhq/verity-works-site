export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname === "www.verityworks.dev") {
      trackEvent(ctx, env, request, "redirect", 301, {
        routeGroup: "canonical",
        targetPath: url.pathname,
      });
      url.hostname = "verityworks.dev";
      return Response.redirect(url.toString(), 301);
    }

    if (
      url.pathname === "/scans/gleason-orthodontics" ||
      url.pathname === "/scans/gleason-orthodontics/" ||
      url.pathname === "/scans/gleason-orthodontics/index.html"
    ) {
      url.pathname = "/scan/gleason-orthodontics/";
      trackEvent(ctx, env, request, "redirect", 301, {
        routeGroup: "scan",
        targetPath: url.pathname,
      });
      return Response.redirect(url.toString(), 301);
    }

    if (
      url.pathname === "/scan/wright-elder-injury" ||
      url.pathname === "/scan/wright-elder-injury/" ||
      url.pathname === "/scan/wright-elder-injury/index.html"
    ) {
      url.pathname = "/snapshots/wright-elder-injury/";
      trackEvent(ctx, env, request, "redirect", 301, {
        routeGroup: "snapshot",
        targetPath: url.pathname,
      });
      return Response.redirect(url.toString(), 301);
    }

    if (
      url.pathname === "/verity-scan" ||
      url.pathname === "/verity-scan/" ||
      url.pathname === "/verity-scan/index.html"
    ) {
      url.pathname = "/free-visibility-snapshot/";
      trackEvent(ctx, env, request, "redirect", 301, {
        routeGroup: "marketing",
        targetPath: url.pathname,
      });
      return Response.redirect(url.toString(), 301);
    }

    if (isWrightSnapshotPath(url.pathname)) {
      const authResponse = await authorizeWrightSnapshot(request, env, ctx);
      if (authResponse) {
        return authResponse;
      }

      return noStoreAssetResponse(request, env, ctx, "protected_view");
    }

    if (isSignalFoundryPath(url.pathname)) {
      const authResponse = authorizeSignalFoundry(request, env);
      if (authResponse) {
        trackEvent(ctx, env, request, "auth_required", authResponse.status, {
          routeGroup: "internal",
        });
        return authResponse;
      }

      return noStoreAssetResponse(request, env, ctx, "protected_view");
    }

    const response = await env.ASSETS.fetch(request);
    trackAssetResponse(ctx, env, request, response, "page_view");
    return response;
  },
};

function isWrightSnapshotPath(pathname) {
  return (
    pathname === "/snapshots/wright-elder-injury" ||
    pathname === "/snapshots/wright-elder-injury/" ||
    pathname === "/snapshots/wright-elder-injury/index.html" ||
    pathname.startsWith("/snapshots/wright-elder-injury/")
  );
}

function isSignalFoundryPath(pathname) {
  return (
    pathname === "/signalfoundry" ||
    pathname === "/signalfoundry/" ||
    pathname === "/signalfoundry.html" ||
    pathname.startsWith("/signalfoundry/")
  );
}

async function authorizeWrightSnapshot(request, env, ctx) {
  const expectedPassword = env.WRIGHT_SNAPSHOT_PASSWORD || "wright2026";
  const cookie = request.headers.get("Cookie") || "";
  if (cookie.split(";").some((part) => part.trim() === "wright_snapshot=ok")) {
    return null;
  }

  if (request.method === "POST") {
    let suppliedPassword = "";
    try {
      const form = await request.formData();
      suppliedPassword = String(form.get("password") || "");
    } catch {
      trackEvent(ctx, env, request, "snapshot_unlock_failed", 401, {
        routeGroup: "snapshot",
      });
      return snapshotPasswordPage(true);
    }

    if (suppliedPassword === expectedPassword) {
      const url = new URL(request.url);
      trackEvent(ctx, env, request, "snapshot_unlock_success", 303, {
        routeGroup: "snapshot",
        targetPath: url.pathname,
      });
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname,
          "Set-Cookie": "wright_snapshot=ok; Path=/snapshots/wright-elder-injury/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax",
          "Cache-Control": "no-store",
        },
      });
    }

    trackEvent(ctx, env, request, "snapshot_unlock_failed", 401, {
      routeGroup: "snapshot",
    });
    return snapshotPasswordPage(true);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    trackEvent(ctx, env, request, "method_not_allowed", 405, {
      routeGroup: "snapshot",
    });
    return new Response("Method not allowed.", {
      status: 405,
      headers: {
        "Cache-Control": "no-store",
        Allow: "GET, HEAD, POST",
      },
    });
  }

  trackEvent(ctx, env, request, "snapshot_gate_view", 401, {
    routeGroup: "snapshot",
  });
  return snapshotPasswordPage(false);
}

function authorizeSignalFoundry(request, env) {
  const expectedUsername = env.SIGNAL_FOUNDRY_USERNAME || "verity";
  const expectedPassword = env.SIGNAL_FOUNDRY_PASSWORD;

  if (!expectedPassword) {
    return new Response("Signal Foundry access is not configured.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const header = request.headers.get("Authorization") || "";
  const prefix = "Basic ";
  if (!header.startsWith(prefix)) {
    return authRequired();
  }

  let decoded = "";
  try {
    decoded = atob(header.slice(prefix.length));
  } catch {
    return authRequired();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return authRequired();
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  if (username !== expectedUsername || password !== expectedPassword) {
    return authRequired();
  }

  return null;
}

function authRequired() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Signal Foundry", charset="UTF-8"',
    },
  });
}

function snapshotPasswordPage(hasError) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Private Verity Snapshot</title>
  <style>
    :root {
      --ink: #17201b;
      --muted: #647067;
      --line: #d8ddd5;
      --paper: #fbfaf6;
      --panel: #ffffff;
      --green: #176b57;
      --green-ink: #0f453a;
      --soft-green: #eef6f1;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      color: var(--ink);
      background: var(--paper);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    main {
      width: min(100%, 440px);
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 1px 2px rgb(23 32 27 / 6%);
    }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--green-ink);
      font-size: .78rem;
      font-weight: 850;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.8rem, 7vw, 2.5rem);
      line-height: 1.05;
    }
    p {
      margin: 14px 0 0;
      color: var(--muted);
    }
    form {
      display: grid;
      gap: 12px;
      margin-top: 22px;
    }
    label {
      display: grid;
      gap: 7px;
      color: var(--ink);
      font-weight: 750;
    }
    input {
      width: 100%;
      min-height: 46px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      color: var(--ink);
      font: inherit;
    }
    input:focus {
      outline: 3px solid var(--soft-green);
      border-color: var(--green);
    }
    button {
      min-height: 46px;
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      background: var(--green);
      color: white;
      font: inherit;
      font-weight: 850;
      cursor: pointer;
    }
    .error {
      color: #8f463b;
      font-weight: 750;
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Verity Works</p>
    <h1>Private snapshot</h1>
    <p>This Verity Snapshot is shared privately. Enter the password to continue.</p>
    ${hasError ? '<p class="error">That password did not work. Please try again.</p>' : ""}
    <form method="post">
      <label>
        Password
        <input name="password" type="password" autocomplete="current-password" autofocus required>
      </label>
      <button type="submit">View snapshot</button>
    </form>
  </main>
</body>
</html>`, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function noStoreAssetResponse(request, env, ctx, eventName = "page_view") {
  const response = await env.ASSETS.fetch(request);
  trackAssetResponse(ctx, env, request, response, eventName);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function trackAssetResponse(ctx, env, request, response, eventName) {
  const contentType = response.headers.get("Content-Type") || "";
  const routeGroup = routeGroupForPath(new URL(request.url).pathname);
  const event =
    eventName === "protected_view" && !contentType.includes("text/html")
      ? "protected_asset_view"
      : eventName;
  if (
    event === "page_view" &&
    !contentType.includes("text/html")
  ) {
    return;
  }
  trackEvent(ctx, env, request, event, response.status, { routeGroup });
}

function trackEvent(ctx, env, request, eventName, status, options = {}) {
  if (!env.ANALYTICS_DB || request.method === "HEAD") {
    return;
  }

  const url = new URL(request.url);
  const routeGroup = options.routeGroup || routeGroupForPath(url.pathname);
  const write = env.ANALYTICS_DB.prepare(
    `INSERT INTO events (
      hostname,
      event_name,
      path,
      route_group,
      status,
      country,
      referrer_host,
      user_agent_class,
      target_path
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(
      url.hostname,
      eventName,
      url.pathname,
      routeGroup,
      Number(status) || 0,
      countryForRequest(request),
      referrerHost(request),
      userAgentClass(request),
      options.targetPath || ""
    )
    .run();

  if (ctx?.waitUntil) {
    ctx.waitUntil(write);
    return;
  }

  write.catch(() => {});
}

function routeGroupForPath(pathname) {
  if (pathname === "/" || pathname === "/index.html") {
    return "homepage";
  }
  if (pathname.startsWith("/snapshots/")) {
    return "snapshot";
  }
  if (pathname.startsWith("/scan/") || pathname.startsWith("/scans/")) {
    return "scan";
  }
  if (pathname.startsWith("/signalfoundry")) {
    return "internal";
  }
  if (
    pathname.startsWith("/free-visibility-snapshot") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/anthony")
  ) {
    return "marketing";
  }
  return "site";
}

function countryForRequest(request) {
  return request.cf?.country || "unknown";
}

function referrerHost(request) {
  const referrer = request.headers.get("Referer") || "";
  if (!referrer) {
    return "direct";
  }
  try {
    return new URL(referrer).hostname;
  } catch {
    return "invalid";
  }
}

function userAgentClass(request) {
  const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();
  if (!userAgent) {
    return "unknown";
  }
  if (/bot|crawl|spider|slurp|preview|facebookexternalhit|linkedinbot|twitterbot/.test(userAgent)) {
    return "bot";
  }
  if (/mobile|android|iphone|ipad/.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
}
