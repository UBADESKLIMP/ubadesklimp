import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Products from '@/components/Products';
import About from '@/components/About';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Products />
        <About />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
