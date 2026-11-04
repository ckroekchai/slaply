import { handleApi } from './api.mjs';
export { BrandGenerationWorkflow } from './workflow.mjs';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.hostname==='www.slaply.co')return Response.redirect(`https://slaply.co${url.pathname}${url.search}`,308);
    if(url.pathname.startsWith('/api/'))return handleApi(request,env);
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','same-origin');
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    headers.set('X-Frame-Options','DENY');
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if(url.protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};
