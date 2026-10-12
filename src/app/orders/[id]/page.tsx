import { OrderDetail } from '../../../components/OrdersView';
export const metadata = { title: 'تفاصيل الطلب — Dev-X Book Store' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OrderDetail id={id} />; }
