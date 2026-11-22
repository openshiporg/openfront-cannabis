import type { Metadata } from 'next';
import { AccountSignUpPage } from '@/features/storefront/screens/AccountPage';
export default AccountSignUpPage;
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create account', robots: { index: false } };
