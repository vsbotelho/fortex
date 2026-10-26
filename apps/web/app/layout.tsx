import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fortex — embarcador',
  description: 'Publique cargas com preço dentro da lei.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topo">
          <div className="topo-conteudo">
            <span className="marca">FORTEX</span>
            <nav aria-label="Menu do embarcador">
              <a href="/" aria-current="page">Publicar carga</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
