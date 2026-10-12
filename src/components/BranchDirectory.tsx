'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ApiResult } from '../lib/api';
import { validHttpsUrl, validPhoneLink } from '../lib/storefront-contacts';
import { ORIGINAL_DEMO_BRANCHES } from '../lib/original-store-content';

interface Branch {
  id: string;
  name: string;
  address: string;
  hours: string;
  phone: string;
  mapUrl: string;
}

type BranchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; branches: Branch[] };

function branchState(result: ApiResult<{ branches: Branch[] }>): BranchState {
  return result.ok ? { status: 'ready', branches: result.data.branches } : { status: 'error', message: result.message };
}

export function BranchDirectory({ demoFallbackEnabled = false }: { demoFallbackEnabled?: boolean }) {
  const [state, setState] = useState<BranchState>({ status: 'loading' });
  const load = useCallback(() => api<{ branches: Branch[] }>('/api/v1/branches'), []);

  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setState(branchState(result)); });
    return () => { active = false; };
  }, [load]);

  return (
    <section className="card">
      <h1>فروع الاستلام</h1>
      <p className="muted">{demoFallbackEnabled ? 'تعرض الصفحة الفروع المسجلة، وقد تعرض أسماء التصميم كأمثلة فقط في التطوير عند خلو القائمة.' : 'هذه الفروع المتاحة حاليًا للاستلام عند إتمام الطلب.'}</p>
      {state.status === 'loading' && <div className="spin" role="status">جاري تحميل الفروع…</div>}
      {state.status === 'error' && <div className="msg err" role="alert">{state.message} <button type="button" className="btn ghost sm" onClick={() => { setState({ status: 'loading' }); void load().then((result) => setState(branchState(result))); }}>إعادة المحاولة</button></div>}
      {state.status === 'ready' && state.branches.length === 0 && !demoFallbackEnabled && <div className="msg warn" role="status">لا توجد فروع متاحة للاستلام حاليًا.</div>}
      {state.status === 'ready' && state.branches.length === 0 && demoFallbackEnabled && <>
        <div className="msg warn" role="status">هذه أسماء أمثلة محفوظة من التصميم الأصلي فقط؛ ليست فروعًا مؤكدة ولا تتوفر لها عناوين أو بيانات استلام. لا يمكن اختيارها لطلب.</div>
        <div className="grid">
          {ORIGINAL_DEMO_BRANCHES.map((branch) => <article className="card" key={branch.id}>
            <h2>{branch.name}</h2>
            <p className="muted">مثال من التصميم الأصلي — غير مؤكد وغير متاح للاستلام.</p>
          </article>)}
        </div>
      </>}
      {state.status === 'ready' && state.branches.length > 0 && <div className="grid">
        {state.branches.map((branch) => {
          const phone = validPhoneLink(branch.phone);
          const mapUrl = validHttpsUrl(branch.mapUrl);
          return <article className="card" key={branch.id}>
            <h2>{branch.name}</h2>
            {branch.address && <p>{branch.address}</p>}
            {branch.hours && <p><b>ساعات العمل:</b> {branch.hours}</p>}
            {phone && <p><a href={phone.href} dir="ltr">{phone.label}</a></p>}
            {mapUrl && <p><a href={mapUrl} target="_blank" rel="noreferrer">عرض الموقع على الخريطة</a></p>}
          </article>;
        })}
      </div>}
    </section>
  );
}
