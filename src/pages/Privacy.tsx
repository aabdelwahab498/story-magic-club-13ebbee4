import LegalPage from "@/components/LegalPage";

const EFFECTIVE_DATE = "May 30, 2026";
const CONTACT_EMAIL = "privacy@najmah.app";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    description="NajmaH Privacy Policy — how we collect, use, and protect information, including COPPA compliance for children."
    path="/privacy"
    effectiveDate={EFFECTIVE_DATE}
  >
    <p>
      NajmaH ("we", "us", "our") provides an AI-powered educational storytelling and audiobook
      platform for families. This Privacy Policy explains how we collect, use, share, and protect
      information when you use our website and services (the "Service"). By using NajmaH, you agree
      to this Policy.
    </p>

    <h2>1. Children's Privacy & COPPA</h2>
    <p>
      NajmaH is designed for use by parents together with their children. In compliance with the
      U.S. Children's Online Privacy Protection Act (COPPA), <strong>NajmaH does not knowingly
      collect personal information directly from children under the age of 13</strong>. Accounts
      may only be created by a parent or legal guardian, who is solely responsible for any child
      profile created within their account.
    </p>
    <p>
      Child profiles created by a parent may contain a first name or nickname, age range, and
      reading preferences. We treat this information as parent-provided data. If you believe a
      child has provided us personal information without parental consent, contact us at{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will promptly delete it.
    </p>

    <h2>2. Information We Collect</h2>
    <h3>From parent accounts</h3>
    <ul>
      <li>Name</li>
      <li>Email address</li>
      <li>Authentication credentials (securely hashed)</li>
      <li>Account preferences and language settings</li>
    </ul>
    <h3>Usage data</h3>
    <ul>
      <li>Stories generated, saved, and read</li>
      <li>Device, browser, and approximate region for security and analytics</li>
      <li>Log data such as IP address and timestamps</li>
    </ul>

    <h2>3. How We Use Information</h2>
    <ul>
      <li>To provide, personalize, and improve the Service</li>
      <li>To generate stories, illustrations, and audio requested by the user</li>
      <li>To process subscriptions and manage accounts</li>
      <li>To communicate service updates, security alerts, and support responses</li>
      <li>To detect, prevent, and address fraud or abuse</li>
    </ul>

    <h2>4. AI Content Generation</h2>
    <p>
      NajmaH uses third-party AI providers, including <strong>OpenAI</strong> and{" "}
      <strong>OpenRouter</strong>, to generate text, illustrations, and audio. When you request
      generated content, the prompt and necessary context are transmitted to these providers solely
      to produce the requested output. We do not send children's personal information in these
      prompts. These providers are contractually bound to handle data in accordance with their
      published policies and applicable law.
    </p>

    <h2>5. Payments</h2>
    <p>
      <strong>Paddle.com Market Limited ("Paddle") is the Merchant of Record</strong> for all
      purchases made on NajmaH. Paddle handles secure billing, payment processing, tax compliance,
      and refunds. We do not store full credit card numbers or banking details on our servers.
      Paddle's handling of your payment information is governed by{" "}
      <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
        Paddle's Privacy Policy
      </a>
      .
    </p>

    <h2>6. Sharing of Information</h2>
    <p>We share information only with:</p>
    <ul>
      <li>Service providers that help us operate the platform (hosting, analytics, email)</li>
      <li>AI providers strictly to fulfill content generation requests (see Section 4)</li>
      <li>Paddle, our Merchant of Record, for payment processing (see Section 5)</li>
      <li>Authorities when required by law or to protect rights, safety, and security</li>
    </ul>
    <p>We do not sell personal information.</p>

    <h2>7. Data Retention</h2>
    <p>
      We retain account information for as long as your account is active. You may delete your
      account at any time, after which we will delete or anonymize personal information unless
      retention is required by law (for example, tax records held by Paddle).
    </p>

    <h2>8. Security</h2>
    <p>
      We use industry-standard safeguards including encryption in transit, hashed credentials,
      row-level security on our database, and access controls. No system is perfectly secure, but
      we work to protect your information consistent with applicable law.
    </p>

    <h2>9. Your Rights</h2>
    <p>
      Depending on your state of residence (including California, Colorado, Virginia, and others),
      you may have the right to access, correct, delete, or port your personal information, and to
      opt out of certain processing. To exercise these rights, contact{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>

    <h2>10. International Users</h2>
    <p>
      NajmaH is operated from the United States. If you access the Service from outside the U.S.,
      you consent to the transfer and processing of your information in the United States.
    </p>

    <h2>11. Changes to This Policy</h2>
    <p>
      We may update this Policy from time to time. Material changes will be communicated through
      the Service or by email. The "Effective date" above reflects the latest version.
    </p>

    <h2>12. Contact Us</h2>
    <p>
      Questions about this Policy or our privacy practices? Contact us at{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
    <p className="text-sm text-muted-foreground">
      [Mailing address placeholder — to be added by NajmaH]
    </p>
  </LegalPage>
);

export default Privacy;
