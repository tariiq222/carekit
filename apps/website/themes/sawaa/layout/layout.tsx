import type { ThemeLayoutProps } from '../../types';
import { Footer } from '../components/layout/footer';
import { Navbar } from '../components/layout/navbar';
import '../theme.css';

export function SawaaLayout({ children }: ThemeLayoutProps) {
  return (
    <div className="theme-sawaa">
      <Navbar />
      <main className="relative">{children}</main>
      <Footer />
    </div>
  );
}
