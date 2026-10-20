export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      apiKey: process.env.FIREBASE_WEB_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      appId: process.env.FIREBASE_WEB_APP_ID,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
