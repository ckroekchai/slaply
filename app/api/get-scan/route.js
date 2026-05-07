export async function GET() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Next step: return safe preview/report data for a scan id."
    },
    { status: 501 }
  );
}
