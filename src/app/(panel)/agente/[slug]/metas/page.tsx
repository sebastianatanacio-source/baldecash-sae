import AgenteView from '../AgenteView';
import { loadAgenteContext } from '../loader';
import { EmptyAgente } from '../EmptyAgente';

export const dynamic = 'force-dynamic';

export default async function AgenteMetasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await loadAgenteContext(slug);
  if (!ctx.ok) return <EmptyAgente slug={ctx.slug} reason={ctx.reason} rolPuedeCargar={ctx.rolPuedeCargar} />;
  return <AgenteView snapshot={ctx.snapshot} config={ctx.config} agenteSlug={ctx.slug} vista="metas" />;
}
