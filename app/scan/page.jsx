const productCategories = [
  "Beauty / skincare",
  "Food / beverage",
  "Wellness / supplement",
  "Marketplace / DTC",
  "Other"
];

const salesChannels = [
  "Shelf / retail",
  "Shopee / Lazada",
  "TikTok",
  "Website",
  "OEM",
  "Other"
];

export default function ScanPage() {
  return (
    <main id="scan" className="cta page-shell">
      <div className="container cta-grid">
        <div className="cta-copy">
          <span className="eyebrow">Start scan</span>
          <h2>Upload one artwork.<br />Get a clearer visual decision.</h2>
          <p>
            Phase 1 accepts one JPG or PNG front packaging image. Slaply returns an AI visual review,
            not legal, compliance, FDA, Thai FDA, or print approval.
          </p>
        </div>

        <form className="scan-form" action="#" method="post">
          <div className="dropzone">
            <span className="upload-icon">+</span>
            <strong>Upload your artwork</strong>
            <p>High-quality PNG or JPG</p>
            <input type="file" name="image" accept="image/png,image/jpeg" aria-label="Upload artwork" />
          </div>

          <input type="email" name="email" placeholder="Email" required />

          <select name="product_category" defaultValue="" required>
            <option value="" disabled>Product category</option>
            {productCategories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select name="sales_channel" defaultValue="" required>
            <option value="" disabled>Sales channel</option>
            {salesChannels.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <input name="target_customer" placeholder="Target customer" required />
          <input name="main_concern" placeholder="Main concern" required />

          <label className="consent-row">
            <input type="checkbox" name="consent" required />
            <span>I own or have permission to upload this artwork and understand this is an AI visual review only.</span>
          </label>

          <button type="submit" className="button button-primary">Submit for scan</button>
        </form>
      </div>
    </main>
  );
}
