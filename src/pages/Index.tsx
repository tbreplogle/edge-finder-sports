import { Hero } from '@/components/Hero';
import { CallToAction } from '@/components/CallToAction';
import { FAQ } from '@/components/FAQ';
import { Testimonials } from '@/components/Testimonials';
import { FeaturedGame } from '@/components/FeaturedGame';
import { MatchupTicker } from '@/components/MatchupTicker';
import { Pricing } from '@/components/Pricing';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Index() {
  const { isPaid, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to /admin if the user is an admin but not on the /admin page
    if (isAdmin && !router.pathname.startsWith('/admin')) {
      router.push('/admin');
    }
  }, [isAdmin, router]);

  return (
    <>
      <Hero />

      {/* Ticker */}
      <MatchupTicker />

      {/* Featured Games */}
      <section className="py-6 md:py-10">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Featured Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeaturedGame 
              isPaid={isPaid} 
              isAdmin={isAdmin} 
            />
            <FeaturedGame 
              isPaid={isPaid}
              isAdmin={isAdmin}
            />
            <FeaturedGame 
              isPaid={isPaid}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </section>

      <CallToAction />
      <Pricing />
      <Testimonials />
      <FAQ />
    </>
  );
}
