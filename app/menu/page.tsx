import { redirect } from 'next/navigation';

/** The menu lives on the home page; /menu is the address people type, so send it there. */
export default function MenuIndex() {
  redirect('/#menu');
}
