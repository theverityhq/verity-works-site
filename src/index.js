export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.verityworks.dev") {
      url.hostname = "verityworks.dev";
      return Response.redirect(url.toString(), 301);
    }

    if (
      url.pathname === "/scans/gleason-orthodontics" ||
      url.pathname === "/scans/gleason-orthodontics/" ||
      url.pathname === "/scans/gleason-orthodontics/index.html"
    ) {
      url.pathname = "/scan/gleason-orthodontics/";
      return Response.redirect(url.toString(), 301);
    }

    if (isSignalFoundryPath(url.pathname)) {
      const authResponse = authorizeSignalFoundry(request, env);
      if (authResponse) {
        return authResponse;
      }

      return noStoreAssetResponse(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

function isSignalFoundryPath(pathname) {
  return (
    pathname === "/signalfoundry" ||
    pathname === "/signalfoundry/" ||
    pathname === "/signalfoundry.html" ||
    pathname.startsWith("/signalfoundry/")
  );
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

async function noStoreAssetResponse(request, env) {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
