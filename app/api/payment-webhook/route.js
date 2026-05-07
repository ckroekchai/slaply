export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message:
        "Next step: verify payment provider callback if the PromptPay provider supports webhooks, then mark the scan paid and unlock the report."
    },
    { status: 501 }
  );
}
