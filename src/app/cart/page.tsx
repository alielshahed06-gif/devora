import { CartView } from '../../components/CartView';
import { isDemoCatalogEnabled } from '../../server/catalog';
export const metadata = { title: 'السلة — Dev-X Book Store' };
export const dynamic = 'force-dynamic';
export default function CartPage() { return <><h1>السلة</h1><CartView demoMode={isDemoCatalogEnabled()} /></>; }
