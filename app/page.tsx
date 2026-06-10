// app/page.tsx
import HomeNav from "@/components/home/HomeNav";
import HomeHero from "@/components/home/HomeHero";
import HomeBand from "@/components/home/HomeBand";
import HomeWhy from "@/components/home/HomeWhy";
import HomeFeatures from "@/components/home/HomeFeatures";
import HomeDarkFeatures from "@/components/home/HomeDarkFeatures";
import HomeFounder from "@/components/home/HomeFounder";
import HomePricing from "@/components/home/HomePricing";
import HomeFAQ from "@/components/home/HomeFAQ";
import HomeCTA from "@/components/home/HomeCTA";
import HomeFooter from "@/components/home/HomeFooter";
import "../app/home.css";

export default function HomePage() {
  return (
    <main className="homePage">
      <HomeNav />
      <HomeHero />
      <HomeBand />
      <HomeWhy />
      <HomeFeatures />
      <HomeDarkFeatures />
      <HomeFounder />
      <HomePricing />
      <HomeFAQ />
      <HomeCTA />
      <HomeFooter />
    </main>
  );
}
