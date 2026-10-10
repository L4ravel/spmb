"use client";

import Header from "./landing-page/header";
import Hero from "./landing-page/hero";
import Footer from "./landing-page/footer";

export default function Page() {
  return (
    <main className="spmb-public min-h-screen">
      <Header />
      <Hero />     
      <Footer />
    </main>
  );
}
