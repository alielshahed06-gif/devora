import { CheckoutForm } from '../../components/CheckoutForm';
import { isDemoCatalogEnabled } from '../../server/catalog';
export const metadata = { title: 'إتمام الطلب — Dev-X Book Store' };
export const dynamic = 'force-dynamic';
export default function Page() {
  if (isDemoCatalogEnabled()) return <div className="card"><h1>إتمام الطلب</h1><p className="msg warn">إتمام الطلب غير متاح في وضع العرض التجريبي. اربط قاعدة بيانات محلية وفعّل مصدر الكتالوج database.</p></div>;
  return <CheckoutForm />;
}
