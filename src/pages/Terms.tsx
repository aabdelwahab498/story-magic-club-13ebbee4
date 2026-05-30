import LegalPage from "@/components/LegalPage";

const EFFECTIVE_DATE = "May 30, 2026";
const CONTACT_EMAIL = "support@najmah.app";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    description="NajmaH Terms of Service — user responsibilities, acceptable use, AI content disclaimers, payments, and liability."
    path="/terms"
    effectiveDate={EFFECTIVE_DATE}
  >
    <p>
      Welcome to NajmaH. These Terms of Service ("Terms") govern your access to and use of the
      NajmaH website, applications, and services (the "Service"). By creating an account or using
      the Service, you agree to these Terms. If you do not agree, do not use the Service.
    </p>

    <h2>1. Eligibility & Accounts</h2>
    <p>
      You must be at least 18 years old and a parent or legal guardian to create an account.
      Children may use the Service only under the supervision of their parent or guardian, and only
      through a profile created within a parent account. You are responsible for maintaining the
      confidentiality of your credentials and for all activity that occurs under your account.
    </p>

    <h2>2. User Responsibilities</h2>
    <ul>
      <li>Provide accurate account information and keep it current.</li>
      <li>Supervise your children's use of the Service.</li>
      <li>Review AI-generated content before sharing it with your child.</li>
      <li>Comply with all applicable laws when using the Service.</li>
    </ul>

    <h2>3. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service to generate or distribute content that is unlawful, harmful, abusive, sexually explicit, hateful, or otherwise inappropriate, particularly for children.</li>
      <li>Attempt to bypass safety filters, rate limits, or access controls.</li>
      <li>Reverse engineer, scrape, or interfere with the Service or its infrastructure.</li>
      <li>Use the Service to train competing AI models.</li>
      <li>Resell, sublicense, or commercially exploit the Service without our written consent.</li>
    </ul>

    <h2>4. AI-Generated Content Disclaimer</h2>
    <p>
      NajmaH uses artificial intelligence to generate stories, illustrations, and audio. AI output
      may be inaccurate, inconsistent, or unsuitable for some audiences. <strong>Parents are
      responsible for reviewing generated content before presenting it to a child.</strong> NajmaH
      does not guarantee the accuracy, completeness, or age-appropriateness of any AI-generated
      output and disclaims all warranties regarding such content to the fullest extent permitted by
      law.
    </p>

    <h2>5. Intellectual Property</h2>
    <p>
      The Service, including software, design, trademarks, and curated content, is owned by NajmaH
      and protected by intellectual property laws. Subject to your compliance with these Terms, we
      grant you a limited, non-exclusive, non-transferable license to use the Service for personal,
      non-commercial family use.
    </p>
    <p>
      Stories generated for your account through your prompts may be used by you for personal,
      non-commercial purposes within your household. You may not claim AI-generated content as
      original human authorship where prohibited by law.
    </p>

    <h2>6. Payments & Subscriptions</h2>
    <p>
      Paid plans are sold by <strong>Paddle.com Market Limited ("Paddle"), our Merchant of
      Record</strong>. Paddle handles billing, payment processing, taxes, and refunds in
      accordance with{" "}
      <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
        Paddle's Checkout Buyer Terms
      </a>
      . Subscriptions automatically renew at the end of each billing period unless cancelled before
      renewal. You may cancel at any time from your account settings; cancellation takes effect at
      the end of the current billing period. Refund requests are handled by Paddle in accordance
      with their refund policy and applicable law.
    </p>

    <h2>7. Account Termination</h2>
    <p>
      You may delete your account at any time. We may suspend or terminate your account if you
      violate these Terms, abuse the Service, or for legal or security reasons. Upon termination,
      your right to use the Service ends immediately, and we may delete account content subject to
      our Privacy Policy and applicable law.
    </p>

    <h2>8. Disclaimers</h2>
    <p>
      THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
      IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
      COMPONENTS.
    </p>

    <h2>9. Limitation of Liability</h2>
    <p>
      TO THE FULLEST EXTENT PERMITTED BY LAW, NAJMAH AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND
      AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
      DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL ARISING FROM YOUR USE OF THE
      SERVICE. OUR AGGREGATE LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE WILL NOT EXCEED THE
      AMOUNT YOU PAID TO PADDLE FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR
      USD $100, WHICHEVER IS GREATER.
    </p>

    <h2>10. Indemnification</h2>
    <p>
      You agree to indemnify and hold NajmaH harmless from any claims, damages, or expenses arising
      from your misuse of the Service, your violation of these Terms, or your violation of any
      rights of a third party.
    </p>

    <h2>11. Governing Law & Dispute Resolution</h2>
    <p>
      These Terms are governed by the laws of the State of [State placeholder], United States,
      without regard to its conflict of law principles. Any dispute will be resolved exclusively in
      the state or federal courts located in [Venue placeholder], unless otherwise required by law.
    </p>

    <h2>12. Changes to These Terms</h2>
    <p>
      We may update these Terms from time to time. Material changes will be communicated through
      the Service or by email. Continued use of the Service after changes take effect constitutes
      acceptance of the updated Terms.
    </p>

    <h2>13. Contact</h2>
    <p>
      Questions about these Terms? Contact us at{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  </LegalPage>
);

export default Terms;
