export async function getCloudflareEnv() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return null;
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return context?.env || null;
  } catch {
    return null;
  }
}

export async function getCloudflareBindings() {
  const env = await getCloudflareEnv();

  return {
    d1: env?.SLAPLY_DB || null,
    uploads: env?.SLAPLY_UPLOADS || null
  };
}
