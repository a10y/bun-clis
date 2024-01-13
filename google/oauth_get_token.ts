///
/// This script will create a webserver on localhost:3000 that Google can OAuth2 flow with.
/// This allows you to easily login and get back a token.
/// It does require that you have already configured an OAuth application with
/// a redirect URI of `http://localhost/redirect`.
///


const CLIENT_ID = Bun.env.CLIENT_ID!;
const CLIENT_SECRET = Bun.env.CLIENT_SECRET!;
const REDIRECT_URI = "http://localhost:3000/redirect";

async function getToken(authorizationCode: string) {
    console.log(`Received auth code ${authorizationCode}, exchanging for token`);
    const form = new FormData();
    form.append("code", authorizationCode);
    form.append("client_id", CLIENT_ID);
    form.append("client_secret", CLIENT_SECRET);
    form.append("redirect_uri", REDIRECT_URI);
    form.append("grant_type", "authorization_code");

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: form,
    });

    return response.json();
}

const srv = Bun.serve({
    fetch: async (req) => {
        // Do matching of the URL against paths
        const url = new URL(req.url);
        const authCode = url.searchParams.get("code");
        if (authCode) {
            console.log("extracting auth.");
            const body = await getToken(authCode);
            console.log(body);
            return Response.json(body);
        } else {
            return new Response("Not found", {
                status: 404,
            });
        }
    }
});

console.log(`serving @ ${srv.url}`);

const loginUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
loginUrl.searchParams.append("scope", "https://www.googleapis.com/auth/drive.readonly");
loginUrl.searchParams.append("include_granted_scopes", "true");
loginUrl.searchParams.append("response_type", "code");
loginUrl.searchParams.append("state", "passthru-fake");
loginUrl.searchParams.append("redirect_uri", "http://localhost:3000/redirect");
loginUrl.searchParams.append("client_id", CLIENT_ID);

// This is necessary to get Google to send you a refresh token from the authorization code.
loginUrl.searchParams.append("access_type", "offline");
loginUrl.searchParams.append("prompt", "consent");


console.log("please click the following link to login:");
console.log(loginUrl.toString());
