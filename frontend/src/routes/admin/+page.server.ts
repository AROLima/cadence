import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { API_BASE_URL } from '$lib/config';

export const load: PageServerLoad = async () => {
  throw redirect(302, `${API_BASE_URL}/admin`);
};
