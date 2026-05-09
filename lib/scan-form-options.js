export const productCategories = [
  "Beauty / Skincare",
  "Supplement / Wellness",
  "Food / Snack / Pet",
  "Ads / Promotion"
];

export function formatProductCategory(category = "") {
  return category === "Ads" ? "Ads / Promotion" : category;
}

export const salesChannels = [
  "Shelf / retail",
  "Shopee / Lazada",
  "TikTok",
  "Website",
  "OEM",
  "Other"
];

export const priceTiers = ["Budget", "Mid", "Premium", "Luxury"];

export const launchStages = [
  "Idea",
  "Pre-production",
  "Ready to print",
  "Already selling"
];

export const reportLanguages = [
  { label: "Thai", value: "thai" },
  { label: "English", value: "english" }
];
