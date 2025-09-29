import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  const role = typeof (user as Record<string, unknown> | null | undefined)?.role === 'string'
    ? (user as Record<string, string>).role
    : undefined;
  if (role !== 'ADMIN') {
    throw redirect(302, '/app');
  }
  return {};
};
