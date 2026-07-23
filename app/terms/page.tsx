// app/terms/page.tsx

import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Terms of Service | FixFlow",
  description:
    "The terms that apply when creating an account and using the FixFlow platform.",
};

export default function TermsPage() {
  return (
    <div className="legalPage">
      <nav className="legalNav">
        <div className="legalNavInner">
          <Link href="/" className="legalNavLogo">
            Fix<span>Flow</span>
          </Link>

          <Link href="/signup" className="legalNavCta">
            Start free
          </Link>
        </div>
      </nav>

      <main className="legalMain">
        <div className="legalContainer">
          <div className="legalHero">
            <div className="legalEyebrow">Legal</div>
            <h1>Terms of Service</h1>
            <p>Last updated: July 2026</p>
          </div>

          <div className="legalBody">
            <section className="legalSection">
              <h2>1. About these terms</h2>

              <p>
                These Terms of Service govern your access to and use of
                FixFlow. By creating an account, starting a trial or otherwise
                using the platform, you confirm that you have read, understood
                and agree to be bound by these terms.
              </p>

              <p>
                If you create an account on behalf of a business or
                organisation, you confirm that you have authority to accept
                these terms on its behalf.
              </p>

              <p>
                If you do not agree to these terms, you must not create an
                account or use FixFlow.
              </p>
            </section>

<section className="legalSection">
  <h2>2. Who we are</h2>

  <p>
    FixFlow is operated by FixFlow Software Ltd, a company
    registered in England and Wales under company number
    <strong> 17288791</strong>, with its registered office at
    <strong> 71–75 Shelton Street, Covent Garden, London, WC2H 9JQ</strong>
    (&quot;FixFlow&quot;, &quot;we&quot;, &quot;us&quot; or
    &quot;our&quot;).
  </p>

  <p>
    <strong>Email:</strong>{" "}
    <a href="mailto:hello@thefixflowapp.com">
      hello@thefixflowapp.com
    </a>
  </p>
</section>



            <section className="legalSection">
              <h2>3. What FixFlow provides</h2>

              <p>
                FixFlow is a cloud-based business management platform designed
                to help tradespeople manage enquiries, customers, estimates,
                jobs, appointments, invoices, communications, documents and
                payments.
              </p>

              <p>
                FixFlow provides software and administrative tools only. We do
                not provide trade services and we are not a party to any
                agreement between you and your customers.
              </p>

              <p>
                You remain responsible for the services you provide, your
                communications with customers, the accuracy of your estimates
                and invoices, the quality and safety of your work, and
                compliance with any laws, regulations or professional
                requirements that apply to your business.
              </p>
            </section>

            <section className="legalSection">
              <h2>4. Eligibility</h2>

              <p>To create an account and use FixFlow, you must:</p>

              <ul>
                <li>Be at least 18 years old</li>
                <li>
                  Be acting for purposes connected with a trade, business or
                  profession
                </li>
                <li>
                  Be based in the United Kingdom or operating a UK business
                </li>
                <li>
                  Have authority to enter into these terms for the relevant
                  business
                </li>
                <li>Use FixFlow only for lawful business purposes</li>
              </ul>

              <p>
                FixFlow is intended for business users and is not supplied for
                personal or household use.
              </p>
            </section>

            <section className="legalSection">
              <h2>5. Your account</h2>

              <p>
                You must provide accurate, complete and current information
                when creating and maintaining your account.
              </p>

              <p>
                You are responsible for keeping your login details secure and
                for all activity carried out through your account. You must not
                share your password or allow another person to access your
                account using your login details.
              </p>

              <p>
                You must notify us promptly if you believe your account has
                been accessed without permission or if the security of your
                login details has been compromised.
              </p>

              <p>
                You can contact us at{" "}
                <a href="mailto:hello@thefixflowapp.com">
                  hello@thefixflowapp.com
                </a>
                .
              </p>
            </section>

            <section className="legalSection">
              <h2>6. Acceptable use</h2>

              <p>You must not use FixFlow to:</p>

              <ul>
                <li>Break any applicable law or regulation</li>
                <li>
                  Upload, store or send unlawful, fraudulent, defamatory,
                  abusive or misleading material
                </li>
                <li>
                  Harass, threaten, discriminate against or harm another person
                </li>
                <li>Misrepresent your identity, qualifications or business</li>
                <li>
                  Upload malicious software, viruses or other harmful code
                </li>
                <li>
                  Attempt to gain unauthorised access to FixFlow, another
                  account or any connected system
                </li>
                <li>
                  Interfere with the security, availability or performance of
                  the platform
                </li>
                <li>
                  Copy, scrape, reverse engineer or attempt to extract the
                  source code of the platform, except where the law expressly
                  permits it
                </li>
                <li>
                  Use FixFlow to send spam, unsolicited marketing or
                  communications that breach privacy or marketing laws
                </li>
                <li>
                  Use the platform for any purpose other than legitimate
                  business management
                </li>
              </ul>

              <p>
                We may investigate suspected misuse and may restrict, suspend
                or terminate access where reasonably necessary to protect
                FixFlow, its users, customers or third parties.
              </p>
            </section>

            <section className="legalSection">
              <h2>7. Trials, pricing and subscriptions</h2>

              <h3>Free access and trials</h3>

              <p>
                We may offer free access, early-access periods or free trials.
                The duration and features included will be shown when you sign
                up or described on the FixFlow website.
              </p>

              <p>
                We may change or withdraw a free-access or early-access offer
                by giving reasonable notice. Where payment details are
                required for a trial, we will explain when billing will begin
                before you subscribe.
              </p>

              <h3>Paid plans</h3>

              <p>
                Paid subscriptions will be charged at the price displayed when
                you subscribe. Unless stated otherwise, subscription fees are
                billed in advance on a recurring monthly or annual basis.
              </p>

              <p>
                Prices may be shown exclusive or inclusive of VAT depending on
                the information displayed at checkout. Any applicable taxes
                will be identified before payment is taken.
              </p>

              <h3>Payment</h3>

              <p>
                Subscription payments are processed by Stripe or another
                payment provider identified at checkout. You authorise the
                relevant provider to charge your selected payment method for
                the applicable subscription fees.
              </p>

              <p>
                You must keep your billing and payment information accurate and
                up to date.
              </p>

              <h3>Failed payments</h3>

              <p>
                If a payment fails, we may retry the payment and contact you to
                request updated payment details. We may restrict or suspend
                access if payment remains outstanding.
              </p>

              <h3>Price changes</h3>

              <p>
                We may change our subscription prices. We will provide
                reasonable advance notice of any increase that affects your
                existing subscription. The new price will apply from your next
                renewal after the notice period.
              </p>
            </section>

            <section className="legalSection">
              <h2>8. Cancellation and refunds</h2>

              <p>
                You may cancel your subscription at any time through the
                available account settings or by contacting us.
              </p>

              <p>
                Unless we tell you otherwise, cancellation takes effect at the
                end of your current paid billing period. You may continue using
                the paid features until that date.
              </p>

              <p>
                Subscription fees already paid are non-refundable, and we do
                not normally provide refunds or credits for partially used
                billing periods, unused accounts or changes of mind.
              </p>

              <p>
                This does not affect any refund or other remedy you may be
                legally entitled to receive. If you believe you have been
                charged incorrectly, contact us at{" "}
                <a href="mailto:hello@thefixflowapp.com">
                  hello@thefixflowapp.com
                </a>
                .
              </p>
            </section>

            <section className="legalSection">
              <h2>9. Affiliate and referral program</h2>

              <p>
                FixFlow may operate a referral or affiliate program that
                allows approved participants to share a referral link or
                discount code with prospective customers.
              </p>

              <p>
                Participation in the affiliate program is subject to separate
                Affiliate Terms, available in our <Link href="/affiliate-terms">Affiliate Terms</Link>, which
                cover matters including:
              </p>

              <ul>
                <li>Who is eligible to take part</li>
                <li>How referrals are tracked and attributed</li>
                <li>
                  When and how referral payouts are calculated and paid
                </li>
                <li>
                  Our right to withhold, adjust or claw back a payout — for
                  example, where a referred customer cancels, refunds or does
                  not remain subscribed for the required qualifying period
                </li>
                <li>
                  Our right to suspend or end a participant&apos;s involvement
                  in the program, including for suspected fraud, self-referral
                  or other misuse
                </li>
              </ul>

              <p>
                If you take part in the affiliate program, you agree to the
                Affiliate Terms in addition to these Terms of Service. Where
                the two conflict on a matter specific to the affiliate
                program, the Affiliate Terms will apply.
              </p>

              <p>
                We may change the structure, rates or availability of the
                affiliate program, or discontinue it, at any time.
              </p>
            </section>

            <section className="legalSection">
              <h2>10. Customer payments and Stripe Connect</h2>

              <p>
                FixFlow may allow you to connect a Stripe account so that your
                customers can make payments relating to estimates, invoices or
                other services you provide.
              </p>

              <p>
                When you create or connect a Stripe account, your use of
                Stripe&apos;s services is also governed by the applicable{" "}
                <a
                  href="https://stripe.com/gb/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stripe terms
                </a>
                .
              </p>

              <p>
                Customer payments are processed by Stripe and are paid to the
                connected account, subject to Stripe&apos;s fees, verification
                requirements, reserves, restrictions and payment-processing
                rules.
              </p>

              <p>
                FixFlow is not a bank, payment institution or escrow provider.
                We do not control payment authorisations, settlement times,
                chargebacks, payment disputes, account restrictions or funds
                held by Stripe.
              </p>

              <p>
                You remain responsible for the amounts you charge, the
                information shown on your estimates and invoices, refunds owed
                to customers, payment disputes and compliance with tax and
                financial obligations relating to your business.
              </p>
            </section>

            <section className="legalSection">
              <h2>11. Your content and business data</h2>

              <p>
                You retain ownership of the content and business data you
                upload, create or store through FixFlow. This may include
                customer details, messages, photographs, documents, estimates,
                job information and invoices.
              </p>

              <p>
                You grant FixFlow a limited, non-exclusive licence to host,
                copy, process, transmit and display that content only as
                reasonably necessary to provide, secure, maintain and improve
                the service.
              </p>

              <p>
                You are responsible for ensuring that your content is accurate,
                lawful and does not infringe another person&apos;s rights.
              </p>

              <p>
                You should keep copies of any business information that you
                cannot afford to lose. Although we take reasonable steps to
                protect data, FixFlow should not be treated as your sole
                permanent record or backup system.
              </p>
            </section>

            <section className="legalSection">
              <h2>12. Customer personal data</h2>

              <p>
                When you collect, enter or otherwise process your
                customers&apos; personal data using FixFlow, you will generally
                act as the data controller and FixFlow will act as a data
                processor on your behalf.
              </p>

              <p>You are responsible for:</p>

              <ul>
                <li>
                  Identifying and documenting a lawful basis for processing
                  customer data
                </li>
                <li>
                  Giving customers appropriate privacy information
                </li>
                <li>
                  Ensuring the information you collect is relevant and not
                  excessive
                </li>
                <li>
                  Keeping customer information accurate and appropriately
                  secure
                </li>
                <li>
                  Responding to requests concerning access, correction,
                  deletion or other data protection rights
                </li>
                <li>
                  Complying with applicable privacy, electronic communications
                  and direct marketing laws
                </li>
              </ul>

              <p>
                We process personal data in accordance with our{" "}
                <Link href="/privacy">Privacy Policy</Link> and any applicable
                data-processing terms.
              </p>
            </section>

            <section className="legalSection">
              <h2>13. AI-powered features</h2>

              <p>
                FixFlow may use artificial intelligence and automated systems
                to assist with parts of the platform. We may use third-party AI
                service providers, including Anthropic, to deliver these
                features.
              </p>

              <p>AI-powered features may include:</p>

              <ul>
                <li>Extracting information from enquiries and communications</li>
                <li>Summarising enquiries, jobs or customer histories</li>
                <li>Identifying enquiries that may require attention</li>
                <li>
                  Suggesting priorities, next steps or follow-up actions
                </li>
                <li>
                  Drafting messages and other customer communications
                </li>
                <li>Assisting with administrative workflows</li>
              </ul>

              <h3>Your responsibility to review AI output</h3>

              <p>
                AI-generated content is provided as an administrative aid and
                suggestion only. It may be inaccurate, incomplete, misleading
                or unsuitable for a particular customer or situation.
              </p>

              <p>
                You are responsible for checking AI-generated content and
                deciding whether it is appropriate before sending it, saving
                it, relying on it or taking action based on it.
              </p>

              <p>
                You must not rely solely on AI-generated output when making
                safety-critical, legal, financial, regulatory or other
                significant decisions.
              </p>

              <h3>Human control</h3>

              <p>
                Unless you knowingly enable a clearly identified automated
                feature, AI-drafted customer communications will not be sent
                solely because they have been generated. You must review and
                take the required action to approve or send them.
              </p>

              <p>
                Where an automated feature is available, FixFlow will identify
                the feature and provide appropriate controls. You remain
                responsible for deciding whether to enable it and for
                monitoring its use.
              </p>

              <h3>Processing by AI providers</h3>

              <p>
                To provide an AI-powered feature, relevant information may be
                securely transmitted to an AI service provider for processing.
                This may include customer messages, enquiry details, job
                information or other content necessary to generate the
                requested result.
              </p>

              <p>
                We select commercial providers that offer contractual data
                protection and security commitments. We configure and use
                those services in accordance with their applicable commercial
                terms and our Privacy Policy.
              </p>

              <p>
                Some of our service providers, including AI providers, may be
                located outside the UK. Where this involves an international
                transfer of personal data, we put in place appropriate
                safeguards, such as the UK International Data Transfer
                Addendum or equivalent standard contractual clauses, as
                required under UK data protection law. Further detail is set
                out in our <Link href="/privacy">Privacy Policy</Link>.
              </p>

              <p>
                We do not permit AI providers to use FixFlow customer data to
                train their general-purpose models unless we have clearly
                informed you of the change and established an appropriate legal
                basis.
              </p>

              <h3>No professional advice</h3>

              <p>
                AI-generated content does not constitute legal, financial,
                accounting, tax, technical, health and safety or other
                professional advice.
              </p>

              <h3>Changes to AI features</h3>

              <p>
                We may add, update, replace or remove AI-powered features and
                may change the providers used to deliver them. We will update
                our Privacy Policy or provide appropriate notice where a
                material change affects how personal data is processed.
              </p>
            </section>

            <section className="legalSection">
              <h2>14. Third-party services</h2>

              <p>
                FixFlow relies on third-party services to provide certain
                functionality. These may include hosting, authentication,
                communications, payment processing, file storage, analytics and
                artificial intelligence services.
              </p>

              <p>
                Some features may require you to connect or use a separate
                third-party account. Your use of that third-party service may
                be subject to separate terms and privacy policies.
              </p>

              <p>
                We are not responsible for third-party services that we do not
                own or control, including changes, outages, restrictions or
                decisions made by those providers.
              </p>
            </section>

            <section className="legalSection">
              <h2>15. Intellectual property</h2>

              <p>
                FixFlow Software Ltd owns, or has the right to use, the FixFlow
                platform and its software, design, branding, text, graphics,
                functionality and other intellectual property.
              </p>

              <p>
                Subject to these terms, we grant you a limited, non-exclusive,
                non-transferable and revocable right to access and use FixFlow
                for your internal business purposes during your trial,
                subscription or other authorised access period.
              </p>

              <p>
                You must not copy, reproduce, sell, license, distribute,
                commercially exploit or create derivative works from any part
                of FixFlow without our written permission.
              </p>
            </section>

            <section className="legalSection">
              <h2>16. Feedback</h2>

              <p>
                You may choose to provide ideas, suggestions or feedback about
                FixFlow. We may use that feedback to develop and improve the
                platform without restriction or payment to you.
              </p>

              <p>
                This does not give us ownership of your existing business data,
                customer information or other content uploaded to your
                account.
              </p>
            </section>

            <section className="legalSection">
              <h2>17. Availability, maintenance and changes</h2>

              <p>
                We aim to provide a reliable service, but we do not guarantee
                that FixFlow will always be available, uninterrupted, secure or
                free from errors.
              </p>

              <p>
                Access may occasionally be affected by maintenance, updates,
                internet or hosting failures, third-party services, security
                incidents or circumstances outside our reasonable control.
              </p>

              <p>
                We may update, improve, replace or remove features as FixFlow
                develops. Where reasonably possible, we will provide notice
                before making a material change that significantly reduces the
                core functionality of a paid plan.
              </p>
            </section>

            <section className="legalSection">
              <h2>18. Suspension and termination</h2>

              <p>
                You may stop using FixFlow and close your account at any time
                by using any available account closure option or contacting us.
              </p>

              <p>We may restrict, suspend or terminate your account if:</p>

              <ul>
                <li>You materially breach these terms</li>
                <li>Subscription fees remain unpaid</li>
                <li>
                  We reasonably believe the account is being used fraudulently
                  or unlawfully
                </li>
                <li>
                  Your use creates a security risk or could harm FixFlow,
                  another user or a third party
                </li>
                <li>We are required to do so by law or a competent authority</li>
                <li>
                  Continuing to provide the service is no longer reasonably
                  practical
                </li>
              </ul>

              <p>
                Where appropriate, we will give you notice and a reasonable
                opportunity to correct the issue. We may act immediately where
                necessary to address fraud, illegality, security risks or
                serious harm.
              </p>

              <p>
                When your account ends, your right to use FixFlow ends. We may
                retain or delete account data in accordance with our Privacy
                Policy, legal obligations, backup schedules and data-retention
                procedures.
              </p>

              <p>
                You are responsible for exporting any records you need before
                your account is closed or your access expires.
              </p>
            </section>

            <section className="legalSection">
              <h2>19. Disclaimers</h2>

              <p>
                FixFlow is provided as a business administration tool. We do
                not guarantee that use of the platform will generate enquiries,
                secure work, increase revenue, obtain customer payments or
                prevent every missed communication or business loss.
              </p>

              <p>
                You remain responsible for reviewing your records, monitoring
                customer communications, following up enquiries and operating
                your business.
              </p>

              <p>
                To the fullest extent permitted by law, any warranties or terms
                that would otherwise be implied into these terms are excluded.
              </p>
            </section>

            <section className="legalSection">
              <h2>20. Limitation of liability</h2>

              <p>
                Nothing in these terms excludes or limits liability where doing
                so would be unlawful, including liability for:
              </p>

              <ul>
                <li>Death or personal injury caused by negligence</li>
                <li>Fraud or fraudulent misrepresentation</li>
                <li>
                  Any other liability that cannot legally be excluded or
                  limited
                </li>
              </ul>

              <p>
                Subject to the paragraph above, FixFlow will not be liable for:
              </p>

              <ul>
                <li>Loss of profits, sales, revenue or anticipated savings</li>
                <li>Loss of business, contracts or business opportunities</li>
                <li>Loss of goodwill or reputation</li>
                <li>Loss or corruption of data</li>
                <li>Indirect or consequential loss</li>
                <li>
                  Loss caused by incorrect, incomplete or unreviewed
                  information entered into or generated through FixFlow
                </li>
                <li>
                  Loss arising from a third-party service, payment provider or
                  customer dispute
                </li>
                <li>
                  Loss arising from reliance on AI-generated content without
                  appropriate human review
                </li>
              </ul>

              <p>
                Subject to the exclusions above, our total aggregate liability
                arising out of or relating to FixFlow or these terms will not
                exceed the greater of:
              </p>

              <ul>
                <li>
                  The subscription fees you paid to FixFlow during the 12
                  months immediately before the event giving rise to the claim
                </li>
                <li>£100</li>
              </ul>

              <p>
                The limitations in this section apply only to the fullest
                extent permitted by applicable law.
              </p>
            </section>

            <section className="legalSection">
              <h2>21. Your responsibility for claims</h2>

              <p>
                You are responsible for losses, claims, costs or expenses
                reasonably incurred by FixFlow as a direct result of:
              </p>

              <ul>
                <li>Your unlawful use of the platform</li>
                <li>Your material breach of these terms</li>
                <li>
                  Content you upload that infringes another person&apos;s
                  rights
                </li>
                <li>
                  Your failure to comply with applicable data protection or
                  direct marketing laws
                </li>
              </ul>

              <p>
                This section does not require you to compensate us for losses
                caused by our own negligence, breach of these terms or unlawful
                conduct.
              </p>
            </section>

            <section className="legalSection">
              <h2>22. Events outside our control</h2>

              <p>
                We will not be responsible for delay or failure caused by
                events outside our reasonable control. These may include
                failures of internet, telecommunications, cloud hosting,
                payment or utility services; cyberattacks; industrial
                disputes; natural disasters; government action; or widespread
                service disruption.
              </p>
            </section>

            <section className="legalSection">
              <h2>23. Changes to these terms</h2>

              <p>
                We may update these terms to reflect changes to FixFlow, our
                business, legal requirements, security practices or the
                services we use.
              </p>

              <p>
                We will provide reasonable notice of material changes, normally
                by email or through the platform. Where practical, we will give
                at least 14 days&apos; notice before material changes take
                effect.
              </p>

              <p>
                Your continued use of FixFlow after updated terms take effect
                means that you accept the updated terms. If you do not agree,
                you must stop using FixFlow and cancel your subscription before
                the changes take effect.
              </p>
            </section>

            <section className="legalSection">
              <h2>24. General terms</h2>

              <h3>Entire agreement</h3>

              <p>
                These terms, together with our Privacy Policy and any additional
                terms expressly agreed with you, form the agreement between you
                and FixFlow concerning your use of the platform.
              </p>

              <h3>No waiver</h3>

              <p>
                If we delay exercising a right under these terms, that does not
                mean we have waived that right.
              </p>

              <h3>Severability</h3>

              <p>
                If any part of these terms is found to be invalid or
                unenforceable, the remaining provisions will continue to
                apply.
              </p>

              <h3>Assignment</h3>

              <p>
                You may not transfer your rights or obligations under these
                terms without our written consent. We may transfer our rights
                and obligations as part of a reorganisation, financing, sale or
                transfer of FixFlow, provided this does not materially reduce
                your rights.
              </p>

              <h3>No third-party rights</h3>

              <p>
                Unless these terms expressly state otherwise, no person other
                than you and FixFlow has the right to enforce them.
              </p>
            </section>

            <section className="legalSection">
              <h2>25. Governing law and courts</h2>

              <p>
                These terms and any dispute or claim arising from them are
                governed by the laws of England and Wales.
              </p>

              <p>
                The courts of England and Wales will have exclusive
                jurisdiction over any dispute or claim arising from or relating
                to these terms or your use of FixFlow.
              </p>
            </section>

<section className="legalSection">
  <h2>26. Contact us</h2>

  <p>Questions about these terms can be sent to:</p>

  <p>
    <strong>Email:</strong>{" "}
    <a href="mailto:hello@thefixflowapp.com">
      hello@thefixflowapp.com
    </a>
    <br />
    <strong>Company:</strong> FixFlow Software Ltd
    <br />
    <strong>Company number:</strong> 17288791
    <br />
    <strong>Registered office:</strong> 71–75 Shelton Street, Covent
    Garden, London, WC2H 9JQ
  </p>
</section>
          </div>
        </div>
      </main>

      <footer className="legalFooter">
        <div className="legalFooterInner">
          <div className="legalFooterLogo">FixFlow</div>

          <div className="legalFooterLinks">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>

<div className="legalFooterCopy">
  © 2026 FixFlow Software Ltd · Registered in England and Wales ·
  Company number 17288791 · Registered office: 71–75 Shelton Street,
  Covent Garden, London, WC2H 9JQ
</div>
        </div>
      </footer>
    </div>
  );
}
