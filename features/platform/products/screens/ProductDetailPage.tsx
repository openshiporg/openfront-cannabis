import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { BandRow, ListBand, Notice, Panel, PillLink, SectionTitle, sentenceCase, statusTone, Track } from '@/features/platform/components/cannabis-ui';
import { Empty, formatUsableThrough, formatWhen, Pager } from '@/features/platform/operations/components/WorkspaceKit';
import { AmendProductForm } from '@/features/platform/operations/components/OperatorForms';
import { frame, readParams, type Params, type SearchParams } from '@/features/platform/operations/lib/frame';
import { readinessReasons } from '@/features/platform/inventory/lib/custody';

export async function ProductDetailPage({ params: routeParams, searchParams }: { params: Promise<{ id: string }>; searchParams?: SearchParams }) {
  const { id } = await routeParams;
  const path = `/dashboard/platform/menu/${encodeURIComponent(id)}`;
  const params: Params = { ...(await readParams(searchParams)), id: decodeURIComponent(id) };
  return frame('product', path, 'Product', params, data => {
    if (!data.product) return null;
    const product = data.product;
    const ready = data.packages.items.filter(pkg => pkg.readiness.ready);
    const missing = [!data.categories.limit.includes(product.categoryCode) && `No purchase limit for ${product.categoryCode}`, !data.categories.tax.includes(product.taxCategoryCode) && `No tax rule for ${product.taxCategoryCode}`].filter(Boolean).join(' · ');
    return <div className="space-y-8 px-4 pb-28 md:px-6">
      {missing && <Notice tone="danger">{missing}. Pick a category the current sales rules define.</Notice>}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ListBand>
          <BandRow title="SKU" detail={<span className="font-mono">{product.sku}</span>} />
          <BandRow title="Form and brand" detail={[product.form, product.brand].filter(Boolean).join(' · ')} />
          <BandRow title="Categories" detail={<>limit <span className="font-mono">{product.categoryCode}</span> · tax <span className="font-mono">{product.taxCategoryCode}</span></>} />
          <BandRow title="Sale increment" detail={<span className="font-mono">{formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)} · counts {formatMicrounits(product.equivalencyMicrounits)} toward limits</span>} />
          <BandRow title="Price" detail={<span className="font-mono">{formatMinorUnits(product.priceCents, data.currencyCode)}</span>} />
          <BandRow title="Channels" detail={[product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean).join(' · ') || 'None'} />
          <BandRow title="Public description" detail={product.publicDescription || 'None'} />
          <BandRow title="Updated" detail={formatWhen(product.updatedAt, data.timezone)} />
        </ListBand>
        {data.operating.open ? <Panel title="Edit product"><AmendProductForm product={product} limitCategories={data.categories.limit} taxCategories={data.categories.tax} /></Panel> : null}
      </div>
      <section>
        <SectionTitle meta={data.packages.total} action={<Track><PillLink href="/dashboard/platform/receiving">Receive a package</PillLink></Track>}>Packages</SectionTitle>
        <ListBand>
          {data.packages.items.length ? data.packages.items.map(pkg => <Link key={pkg.id} href={`/dashboard/platform/inventory?search=${encodeURIComponent(pkg.packageUid)}`} className="block transition-colors hover:bg-background/60">
            <BandRow title={<span className="font-mono">{pkg.packageUid}</span>} tone={pkg.readiness.ready ? 'ok' : statusTone(pkg.status)} state={pkg.readiness.ready ? 'Ready to sell' : sentenceCase(pkg.status)}
              detail={<>Lot <span className="font-mono">{pkg.lotNumber}</span> · lab {sentenceCase(pkg.testStatus).toLowerCase()} · usable through {formatUsableThrough(pkg.expiresAt, data.timezone)}{!pkg.readiness.ready && readinessReasons(pkg).length ? ` · ${readinessReasons(pkg)[0]}` : ''}</>}
              aside={pkg.balance.state === 'ok' ? <span className="font-mono text-xs">{formatMicrounits(pkg.balance.availableMicrounits, pkg.unitOfMeasure)} free</span> : <span className="text-xs text-destructive">Balance discrepancy</span>} />
          </Link>) : <Empty>No packages for this product.</Empty>}
          <Pager basePath={path} params={{ cursor: params.cursor }} nextCursor={data.packages.nextCursor} shown={data.packages.items.length} total={data.packages.total} noun="packages" />
        </ListBand>
        {ready.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{ready.length} ready on this page</p>}
      </section>
      <section>
        <SectionTitle meta={data.saleLines.length}>Recent sales</SectionTitle>
        <ListBand>{data.saleLines.length ? data.saleLines.map(line => <Link key={line.id} href={line.sale ? `/dashboard/platform/sales/${encodeURIComponent(line.sale.id)}` : '/dashboard/platform/sales'} className="block transition-colors hover:bg-background/60">
          <BandRow title={<span className="font-mono">{line.sale?.receiptNumber ?? 'Receipt not recorded'}</span>} tone={statusTone(line.sale?.status)} state={line.sale ? sentenceCase(line.sale.status) : undefined}
            detail={<>{formatWhen(line.sale?.finalizedAt ?? line.createdAt, data.timezone)} · package <span className="font-mono">{line.packageUidSnapshot}</span></>}
            aside={<span className="font-mono text-xs">{formatMicrounits(line.quantityMicrounits, product.unitOfMeasure)} · {formatMinorUnits(line.totalCents, data.currencyCode)}</span>} />
        </Link>) : <Empty>No sales of this product.</Empty>}</ListBand>
      </section>
    </div>;
  }, data => data.product ? (data.packages.items.some(pkg => pkg.readiness.ready) ? { tone: 'ok', state: 'Ready to sell' } : { tone: data.product.status === 'active' ? 'warn' : 'muted', state: data.product.status === 'active' ? 'Not ready' : sentenceCase(data.product.status) }) : { tone: 'muted', state: '' },
  { crumbs: [{ label: 'Menu', href: '/dashboard/platform/menu' }, { label: 'Product' }], heading: data => data.product?.name ?? 'Product', missing: data => !data.product });
}
