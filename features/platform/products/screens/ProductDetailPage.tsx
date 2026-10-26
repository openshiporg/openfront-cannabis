import type React from 'react';
import Link from 'next/link';
import { formatMinorUnits } from '@/features/lib/money';
import { formatMicrounits } from '@/features/lib/quantity';
import { ButtonLink, ListBand, Notice, Panel, Ref, SectionTitle, StatusText, Table, TEmpty, Td, Th, THead, Tr, sentenceCase, statusTone } from '@/features/platform/components/cannabis-ui';
import { formatUsableThrough, formatWhen, Pager } from '@/features/platform/operations/components/WorkspaceKit';
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
    const facts: Array<[string, React.ReactNode]> = [
      ['SKU', <Ref key="s">{product.sku}</Ref>], ['Form and brand', [product.form, product.brand].filter(Boolean).join(' · ')],
      ['Categories', <>limit {product.categoryCode} · tax {product.taxCategoryCode}</>],
      ['Sale increment', <>{formatMicrounits(product.unitQuantityMicrounits, product.unitOfMeasure)} · counts {formatMicrounits(product.equivalencyMicrounits)} toward limits</>],
      ['Price', <span key="p" className="font-semibold tabular-nums">{formatMinorUnits(product.priceCents, data.currencyCode)}</span>],
      ['Channels', [product.adultUseEligible && 'Adult-use', product.medicalEligible && 'Medical'].filter(Boolean).join(' · ') || 'None'],
      ['Public description', product.publicDescription || 'None'], ['Updated', formatWhen(product.updatedAt, data.timezone)],
    ];
    return <div className="space-y-6 px-4 pb-28 md:px-6">
      {missing && <Notice tone="danger">{missing}. Pick a category the current sales rules define.</Notice>}
      <section>
        <SectionTitle meta={data.packages.total} action={<ButtonLink href="/dashboard/platform/receiving" tone="quiet">Receive a package</ButtonLink>}>Packages</SectionTitle>
        <Table label="Packages" minWidth={720}>
          <THead><Th>Status</Th><Th>Package</Th><Th>Lot</Th><Th>Lab</Th><Th>Usable through</Th><Th align="right">Free</Th></THead>
          <tbody>{data.packages.items.length ? data.packages.items.map(pkg => <Tr key={pkg.id}>
            <Td><StatusText tone={pkg.readiness.ready ? 'ok' : statusTone(pkg.status)}>{pkg.readiness.ready ? 'Ready to sell' : sentenceCase(pkg.status)}</StatusText>{!pkg.readiness.ready && readinessReasons(pkg).length ? <span className="block text-xs text-muted-foreground">{readinessReasons(pkg)[0]}</span> : null}</Td>
            <Td><Link href={`/dashboard/platform/inventory?search=${encodeURIComponent(pkg.packageUid)}`} className="underline-offset-4 hover:underline"><Ref>{pkg.packageUid}</Ref></Link></Td>
            <Td><Ref className="text-muted-foreground">{pkg.lotNumber}</Ref></Td>
            <Td className="text-muted-foreground">{sentenceCase(pkg.testStatus)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatUsableThrough(pkg.expiresAt, data.timezone)}</Td>
            <Td align="right">{pkg.balance.state === 'ok' ? formatMicrounits(pkg.balance.availableMicrounits, pkg.unitOfMeasure) : <span className="text-destructive">Balance discrepancy</span>}</Td>
          </Tr>) : <TEmpty colSpan={6}>No packages for this product.</TEmpty>}</tbody>
        </Table>
        <Pager basePath={path} params={{ cursor: params.cursor }} nextCursor={data.packages.nextCursor} shown={data.packages.items.length} total={data.packages.total} noun="packages" />
        {ready.length > 0 && <p className="text-xs text-muted-foreground">{ready.length} ready on this page</p>}
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Product record</SectionTitle>
          <ListBand><dl className="divide-y divide-border/70 text-[13px]">{facts.map(([term, value]) => <div key={term} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]"><dt className="text-muted-foreground">{term}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl></ListBand>
        </section>
        {data.operating.open ? <Panel title="Edit product"><AmendProductForm product={product} limitCategories={data.categories.limit} taxCategories={data.categories.tax} /></Panel> : null}
      </div>
      <section>
        <SectionTitle meta={data.saleLines.length}>Recent sales</SectionTitle>
        <Table label="Recent sales" minWidth={600}>
          <THead><Th>Receipt</Th><Th>When</Th><Th>Package</Th><Th>Status</Th><Th align="right">Quantity</Th><Th align="right">Total</Th></THead>
          <tbody>{data.saleLines.length ? data.saleLines.map(line => <Tr key={line.id}>
            <Td><Link href={line.sale ? `/dashboard/platform/sales/${encodeURIComponent(line.sale.id)}` : '/dashboard/platform/sales'} className="underline-offset-4 hover:underline"><Ref>{line.sale?.receiptNumber ?? 'Not recorded'}</Ref></Link></Td>
            <Td className="whitespace-nowrap text-muted-foreground">{formatWhen(line.sale?.finalizedAt ?? line.createdAt, data.timezone)}</Td>
            <Td><Ref className="text-muted-foreground">{line.packageUidSnapshot}</Ref></Td>
            <Td>{line.sale ? <StatusText tone={statusTone(line.sale.status)}>{sentenceCase(line.sale.status)}</StatusText> : null}</Td>
            <Td align="right">{formatMicrounits(line.quantityMicrounits, product.unitOfMeasure)}</Td>
            <Td align="right">{formatMinorUnits(line.totalCents, data.currencyCode)}</Td>
          </Tr>) : <TEmpty colSpan={6}>No sales of this product.</TEmpty>}</tbody>
        </Table>
      </section>
    </div>;
  }, data => data.product ? (data.packages.items.some(pkg => pkg.readiness.ready) ? { tone: 'ok', state: 'Ready to sell' } : { tone: data.product.status === 'active' ? 'warn' : 'muted', state: data.product.status === 'active' ? 'Not ready' : sentenceCase(data.product.status) }) : { tone: 'muted', state: '' },
  { crumbs: [{ label: 'Menu', href: '/dashboard/platform/menu' }, { label: 'Product' }], heading: data => data.product?.name ?? 'Product', missing: data => !data.product });
}
