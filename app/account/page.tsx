import type { Metadata } from 'next';
import { AccountPage } from '@/features/storefront/screens/AccountPage';
export default AccountPage;
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account', robots: { index: false } };
