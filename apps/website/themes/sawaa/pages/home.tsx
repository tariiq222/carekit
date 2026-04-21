import { Blog } from '../components/sections/blog';
import { Clinics } from '../components/sections/clinics';
import { CTA } from '../components/sections/cta';
import { FAQ } from '../components/sections/faq';
import { Features } from '../components/sections/features';
import { Hero } from '../components/sections/hero';
import { SupportGroups } from '../components/sections/support-groups';
import { Team } from '../components/sections/team';
import { Testimonials } from '../components/sections/testimonials';

export function SawaaHomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Clinics />
      <SupportGroups />
      <Team />
      <Testimonials />
      <Blog />
      <CTA />
      <FAQ />
    </>
  );
}
