import type { Metadata } from 'next';
import { AccountSignInPage } from '@/features/storefront/screens/AccountPage';
export default AccountSignInPage;
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
