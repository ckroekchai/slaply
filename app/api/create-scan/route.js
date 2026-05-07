export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Next step: validate JPG/PNG upload, save customer and scan rows, then upload artwork to Supabase Storage."
    },
    { status: 501 }
  );
}
