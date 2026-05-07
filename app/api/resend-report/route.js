export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Next step: resend report link for paid scans only."
    },
    { status: 501 }
  );
}
