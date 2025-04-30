
import { AppLayout } from '@/components/AppLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function Privacy() {
  return (
    <AppLayout>
      <div className="container py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-lg mb-6">
              At Play Edge, we respect your privacy and are committed to protecting your personal data. 
              This Privacy Policy explains how we collect, use, and safeguard your information when you 
              use our website and services.
            </p>

            <Accordion type="single" collapsible className="w-full mb-8">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-xl font-semibold">Information We Collect</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p>We collect several types of information from and about users of our website, including information:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>By which you may be personally identified, such as name, email address, and account credentials;</li>
                      <li>About your internet connection, the equipment you use to access our website, and usage details;</li>
                      <li>Your betting preferences, sports interests, and interaction with our platform;</li>
                      <li>Transaction data, including details about payments and subscriptions;</li>
                      <li>Your communication preferences and history of interactions with our customer service.</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-xl font-semibold">How We Use Your Information</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p>We use the information we collect about you to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Provide, maintain, and improve our services;</li>
                      <li>Process transactions and send related information;</li>
                      <li>Send you technical notices, updates, security alerts, and support messages;</li>
                      <li>Personalize your experience by delivering content and product offerings relevant to your interests;</li>
                      <li>Measure and analyze the effectiveness of our services and marketing efforts;</li>
                      <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities;</li>
                      <li>Comply with our legal obligations and enforce our terms of service.</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-xl font-semibold">Data Security</AccordionTrigger>
                <AccordionContent>
                  <p>
                    We implement appropriate technical and organizational measures to protect your personal data against 
                    unauthorized or unlawful processing, accidental loss, destruction, or damage. However, no method of 
                    transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-xl font-semibold">Cookies and Tracking Technologies</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p>
                      We use cookies and similar tracking technologies to track activity on our website and to hold certain 
                      information. Cookies are files with a small amount of data that may include an anonymous unique identifier.
                    </p>
                    <p>
                      We use these technologies for:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Keeping you signed in and recognizing you when you return;</li>
                      <li>Understanding how you use our platform;</li>
                      <li>Personalizing content and offers based on your interests;</li>
                      <li>Measuring the effectiveness of our marketing campaigns;</li>
                      <li>Analyzing site traffic and usage patterns.</li>
                    </ul>
                    <p>
                      You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. 
                      However, if you do not accept cookies, you may not be able to use some portions of our service.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5">
                <AccordionTrigger className="text-xl font-semibold">Third-Party Disclosure</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p>We may disclose your personal information to:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Service providers that perform services on our behalf;</li>
                      <li>Business partners with whom we jointly offer products or services;</li>
                      <li>Legal authorities when required by law or to protect our rights;</li>
                      <li>An acquirer in the event of a merger, divestiture, restructuring, or other sale or transfer of assets.</li>
                    </ul>
                    <p>
                      We do not sell your personal information to third parties for their direct marketing purposes 
                      without your explicit consent.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-6">
                <AccordionTrigger className="text-xl font-semibold">Your Privacy Rights</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>The right to access and receive a copy of your personal data;</li>
                      <li>The right to correct inaccurate personal data;</li>
                      <li>The right to request deletion of your personal data;</li>
                      <li>The right to restrict or object to our processing of your personal data;</li>
                      <li>The right to data portability;</li>
                      <li>The right to withdraw consent at any time.</li>
                    </ul>
                    <p>
                      To exercise these rights, please contact us using the information provided in the "Contact Us" section.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-7">
                <AccordionTrigger className="text-xl font-semibold">Children's Privacy</AccordionTrigger>
                <AccordionContent>
                  <p>
                    Our services are not intended for individuals under the age of 21, and we do not knowingly collect 
                    personal information from children. If you are a parent or guardian and believe we have collected 
                    information from a child under 21, please contact us so we can promptly remove such information.
                  </p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-8">
                <AccordionTrigger className="text-xl font-semibold">Changes to This Privacy Policy</AccordionTrigger>
                <AccordionContent>
                  <p>
                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
                    new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this 
                    Privacy Policy periodically for any changes.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <div className="bg-edge-primary/20 border border-edge-primary/30 rounded-lg p-6 mb-8">
              <h3 className="text-xl font-semibold mb-3">Contact Us</h3>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <address className="not-italic mt-3">
                <p>Email: privacy@playedge.com</p>
                <p>Address: 123 Sports Way, Suite 500</p>
                <p>Las Vegas, NV 89109</p>
              </address>
            </div>
            
            <div className="border-t border-border mt-10 pt-6 text-sm text-muted-foreground">
              <p>Last updated: April 30, 2025</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
