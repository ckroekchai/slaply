export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Next step: load scan context, call OpenAI vision with structured JSON, validate output, and save preview results."
    },
    { status: 501 }
  );
}
