import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Products from '@/components/Products';
import About from '@/components/About';
import Footer from '@/components/Footer';
import { CartProvider } from '@/contexts/CartContext';

const Index = () => {
  return (
    <CartProvider>
      <div className="min-h-screen">
        <Header />
        <main className="pt-14 md:pt-16">
          <Hero />
          <Products />
          <About />
        </main>
        <Footer />
      </div>
    </CartProvider>
  );
};

export default Index;
