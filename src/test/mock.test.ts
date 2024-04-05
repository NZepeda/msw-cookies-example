import { store as cookieStore } from "@mswjs/cookies";
import { serialize as serializeCookie } from "cookie";
import { setupServer, SetupServer } from "msw/node";
import { http, HttpResponse } from "msw";

import { afterEach } from "vitest";

const sessionCookieName = "MyCookie";
const authorizedSessionCookieValue = "ABCD1234";
const url = "https://my-app.mysite.com:9090";

const cookieString = serializeCookie(
  sessionCookieName,
  authorizedSessionCookieValue
);

const tokenEndpoint = `${url}/rest/token`;
const restEndpoint = `${url}/rest`;
const pingEndpoint = `${url}/ping`;

/**
 * Sets the session cookie in the cookie store so that it is picked up by msw.
 */
function setSessionCookie(
  cookieName: string,
  cookieValue: string,
  url: string
) {
  const cookieString = serializeCookie(cookieName, cookieValue);
  cookieStore.add(
    { url, credentials: "same-origin" },
    {
      headers: new Headers({
        "Set-Cookie": cookieString,
      }),
    }
  );
}

/**
 * Compares the cookie value received vs the authorized cookie value to determine if the user is authenticated.
 */
const isAuthenticatedThroughSessionCookie = (
  cookies: Record<string, string>
): boolean => {
  const cookieValue = cookies[sessionCookieName];
  return cookieValue === authorizedSessionCookieValue;
};

const server: SetupServer = setupServer(
  http.get(tokenEndpoint, ({ cookies }) => {
    console.log({ cookies });
    if (isAuthenticatedThroughSessionCookie(cookies)) {
      return HttpResponse.json(
        { data: { token: "mytokenhelloworld" } },
        {
          headers: new Headers({
            "Set-Cookie": cookieString,
          }),
        }
      );
    }
    return HttpResponse.json(null, { status: 401 });
  }),
  http.get(restEndpoint, () => {
    return HttpResponse.json({ myResponse: "Hello" });
  }),
  http.get(pingEndpoint, ({ cookies }) => {
    console.log({ cookies });
    if (isAuthenticatedThroughSessionCookie(cookies)) {
      return HttpResponse.text("pong", {
        status: 200,
      });
    }
    return HttpResponse.json(null, { status: 401 });
  })
);

describe("withJwt", () => {
  beforeAll(() => {
    setSessionCookie(sessionCookieName, authorizedSessionCookieValue, url);
    server.listen();
  });

  afterAll(() => {
    cookieStore.clear();
    server.close();
  });

  it("receives a status code of 200 when hitting the token endpoint when the user is authenticated with the session cookie", async () => {
    const response = await fetch(tokenEndpoint, { credentials: "include" });

    expect(response.status).toBe(200);
  });

  // Checks for the same cookie as the test above but this test fails simply because of the order of the handler in the server setup above.
  it("receives a status code of 200 when hitting the ping endpoint when the user is authenticated with the session cookie", async () => {
    const response = await fetch(pingEndpoint, { credentials: "include" });

    expect(response.status).toBe(200);
  });
});
