"use client";

import Header from "./landing-page/header";
import Hero from "./landing-page/hero";
import SectionsPPDB from "./landing-page/SectionsPPDB";
import Footer from "./landing-page/footer";

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Header />
      <Hero />     
      <Footer />
    </main>
  );
}
