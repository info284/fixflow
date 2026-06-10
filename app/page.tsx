// app/page.tsx
import HomeNav from "@/app/components/home/HomeNav";
import HomeHero from "@/app/components/home/HomeHero";
import HomeBand from "@/app/components/home/HomeBand";
import HomeWhy from "@/app/components/home/HomeWhy";
import HomeFeatures from "@/app/components/home/HomeFeatures";
import HomeDarkFeatures from "@/app/components/home/HomeDarkFeatures";
import HomeFounder from "@/app/components/home/HomeFounder";
import HomePricing from "@/app/components/home/HomePricing";
import HomeFAQ from "@/app/components/home/HomeFAQ";
import HomeCTA from "@/app/components/home/HomeCTA";
import HomeFooter from "@/app/components/home/HomeFooter";
import "./home.css";

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
