const steps = [
  {
    title: "Create a Sanity project",
    body: "Run npx sanity@latest init --env in this folder, or grab an existing project ID from sanity.io/manage.",
  },
  {
    title: "Fill in .env",
    body: "Set PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET and a SANITY_API_READ_TOKEN.",
  },
  {
    title: "Open the Studio",
    body: "Visit /studio, create a Page with slug \"home\", and start stacking building blocks inside a Section.",
  },
  {
    title: "Edit visually",
    body: "Open the Presentation tab in the Studio to drag, drop, and click-to-edit right on the page.",
  },
];

export function Welcome() {
  return (
    <main
      data-theme="light"
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <div style={{ maxWidth: 640, width: "100%" }}>
        <p className="eyebrow eyebrow--sm c-brand">Okapi</p>
        <h1
          className="heading heading--2xl heading--bold"
          style={{ marginTop: 12 }}
        >
          Your visual page builder is ready.
        </h1>
        <p
          className="paragraph paragraph--lg c-muted"
          style={{ marginTop: 16, maxWidth: 520 }}
        >
          No content is loading yet. Connect Sanity and publish a page with the
          slug <code>home</code> to see it here.
        </p>

        <ol style={{ marginTop: 32, paddingLeft: 0, listStyle: "none" }}>
          {steps.map((step, i) => (
            <li
              key={step.title}
              style={{
                display: "flex",
                gap: 16,
                padding: "16px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span
                className="btn btn--primary btn--sm"
                style={{ borderRadius: "999px", pointerEvents: "none" }}
              >
                {i + 1}
              </span>
              <span>
                <strong style={{ display: "block" }}>{step.title}</strong>
                <span className="c-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <a
          className="btn btn--primary btn--lg"
          href="/studio"
          style={{ marginTop: 24 }}
        >
          Open the Studio →
        </a>
      </div>
    </main>
  );
}
