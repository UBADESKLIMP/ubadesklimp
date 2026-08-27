import Header from '@/components/Header';
import Hero from '@/components/Hero';
import AutomotiveBanner from '@/components/AutomotiveBanner';
import Products from '@/components/Products';
import About from '@/components/About';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14 md:pt-16">
        <Hero />
        <AutomotiveBanner />
        <Products />
        <About />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
