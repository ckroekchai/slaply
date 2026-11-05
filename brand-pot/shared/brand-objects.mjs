// A single 1024px AI asset holds three independently reusable 512px objects.
// Geometry belongs to the app, never to model-provided coordinates or URLs.
export const BRAND_OBJECT_IDS = Object.freeze(['object-1','object-2','object-3']);
export const BRAND_OBJECT_CROPS = Object.freeze([
  Object.freeze({x:0,y:0,w:.5,h:.5}),
  Object.freeze({x:.5,y:0,w:.5,h:.5}),
  Object.freeze({x:0,y:.5,w:.5,h:.5}),
]);
export function objectCrop(id) {
  const index=BRAND_OBJECT_IDS.indexOf(id);
  return index<0?null:BRAND_OBJECT_CROPS[index];
}
