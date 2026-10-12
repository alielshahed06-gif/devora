export const usePathname = () => new URLSearchParams(location.search).get('p')?.split('?')[0] || '/';
export const notFound = () => { throw new Error('NOT_FOUND'); };
