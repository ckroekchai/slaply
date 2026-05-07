export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Next step: protect this route, verify operator access, log reason, mark scan paid, and resend report link."
    },
    { status: 501 }
  );
}
