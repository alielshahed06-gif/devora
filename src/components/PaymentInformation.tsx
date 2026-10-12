'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type ApiResult } from '../lib/api';
import { PAYMENT_METHOD_AR } from '../lib/labels';
import { DemoPaymentSimulator } from './DemoPaymentSimulator';

interface PaymentMethod {
  code: string;
  name: string;
  description: string;
}

type PaymentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; methods: PaymentMethod[] };

function paymentState(result: ApiResult<{ methods: PaymentMethod[] }>): PaymentState {
  return result.ok ? { status: 'ready', methods: result.data.methods } : { status: 'error', message: result.message };
}

export function PaymentInformation() {
  const [state, setState] = useState<PaymentState>({ status: 'loading' });
  const load = useCallback(() => api<{ methods: PaymentMethod[] }>('/api/v1/payment-methods'), []);

  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setState(paymentState(result)); });
    return () => { active = false; };
  }, [load]);

  return (
    <>
      <section className="card">
        <h1>طرق الدفع</h1>
        <p>تعرض هذه الصفحة وسائل الدفع الحقيقية المتاحة للطلب، وتفصلها عن وسائل العرض التجريبية.</p>
        {state.status === 'loading' && <div className="spin" role="status">جاري تحميل طرق الدفع…</div>}
        {state.status === 'error' && <div className="msg err" role="alert">{state.message} <button type="button" className="btn ghost sm" onClick={() => { setState({ status: 'loading' }); void load().then((result) => setState(paymentState(result))); }}>إعادة المحاولة</button></div>}
        {state.status === 'ready' && state.methods.length === 0 && <div className="msg warn" role="status">لا توجد وسيلة دفع مفعّلة حاليًا. لا يمكن إتمام الطلب حتى تتاح وسيلة دفع.</div>}
        {state.status === 'ready' && state.methods.length > 0 && <ul>
          {state.methods.map((method) => <li key={method.code}>
            <b>{PAYMENT_METHOD_AR[method.code] ?? method.name}</b>
            {method.description && <p>{method.description}</p>}
          </li>)}
        </ul>}
        <div className="msg info"><p>لا نعرض أو نفعّل الدفع الإلكتروني قبل توافر تكامل موثّق ومتحقق منه. إرسال مرجع تحويل — إن أتيح — لا يعني تأكيد وصول المبلغ.</p></div>
        <Link className="btn" href="/checkout">متابعة إلى إتمام الطلب</Link>
      </section>
      <DemoPaymentSimulator />
    </>
  );
}
