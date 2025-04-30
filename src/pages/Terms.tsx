
import { AppLayout } from '@/components/AppLayout';

export default function Terms() {
  return (
    <AppLayout>
      <div className="container py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-lg mb-6">
              The handicapping and sports‑wagering information contained on this website ("<strong>Game Intel</strong>") is provided
              <strong> strictly for entertainment purposes</strong>. It is your responsibility to confirm and comply with the gambling regulations in your jurisdiction, which vary from state to state, province to province, and country to country. Any use of the information on this site in contravention of applicable law is prohibited.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">Jurisdictions With Specific Online‑Gaming Restrictions</h2>
            <p className="mb-4">
              Residents of the following U.S. states should familiarize themselves with their local statutes, which may impose additional restrictions on participants, advertisers, or businesses involved in online gaming:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-1">
              <li>Illinois</li>
              <li>Indiana</li>
              <li>Louisiana</li>
              <li>Washington&nbsp;State</li>
              <li>Oregon</li>
              <li>Nevada</li>
              <li>Montana</li>
              <li>South&nbsp;Dakota</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">Odds &amp; Data Feeds</h2>
            <p className="mb-6">
              Odds displayed on Game Intel are provided by third‑party sources and refreshed regularly. In the event of any discrepancy between the odds shown on Game Intel and the odds posted on a provider's own website, the provider's website shall be deemed correct.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">Limitation of Liability</h2>
            <p className="mb-6">
              By using Game Intel you agree to hold harmless Game Intel, its parent entities, affiliates, subsidiaries, advertising or promotion agencies, and their respective directors, officers, employees, representatives, and agents from any and all liability—whether for injuries, losses, or damages of any kind (including death) to persons or property—arising in whole or in part, directly or indirectly, from your use of this site.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">External Websites &amp; Advertisers</h2>
            <p className="mb-6">
              Game Intel strives to ensure that all advertisers and external links meet our standards. However, we are not responsible for the offers, promises, or services provided on third‑party websites. You agree that you are solely responsible for any decisions made or issues encountered after leaving Game Intel. If you experience a problem with an operation referenced on this site, please contact us via the <a href="/contact" className="text-edge-secondary hover:underline">Contact page</a>.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">No League Affiliation</h2>
            <p className="mb-6">
              Game Intel is not associated with, endorsed, or sponsored by any professional or collegiate league, team, conference, or organization.
            </p>
            
            <div className="border-t border-border mt-10 pt-6 text-sm text-muted-foreground">
              <p>Last updated: April 30, 2025</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
